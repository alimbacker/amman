'use client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage';
import { FUNCTIONS_REGION, errorMessages, type BookingErrorCode } from '@temple/shared';

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * True when the Firebase web config was present at build time.
 * The NEXT_PUBLIC_* values are inlined into the static bundle by `next build`, so a host
 * (Vercel, Netlify, …) must have them set as environment variables BEFORE building —
 * otherwise `getAuth()` throws `auth/invalid-api-key` and the whole app crashes.
 */
export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

let app: FirebaseApp, db: Firestore, auth: Auth, fns: Functions, storage: FirebaseStorage;

function init() {
  if (app) return;
  app = getApps()[0] ?? initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
  fns = getFunctions(app, FUNCTIONS_REGION);
  storage = getStorage(app);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFunctionsEmulator(fns, 'localhost', 5001);
    connectStorageEmulator(storage, 'localhost', 9199);
  }
}

export const getDb = () => (init(), db);
export const getAuthInstance = () => (init(), auth);

/** Calls an admin Cloud Function; server re-checks the admin claim on every call. */
export async function callAdmin<I, O = { ok: boolean }>(name: string, data: I): Promise<O> {
  init();
  try {
    return (await httpsCallable<I, O>(fns, name, { timeout: 60_000 })(data)).data;
  } catch (e: unknown) {
    const err = e as { message?: string; details?: { code?: BookingErrorCode } };
    const code = err.details?.code;
    throw new Error(code && errorMessages[code] ? `${errorMessages[code].en}${err.message && err.message !== code ? ` (${err.message})` : ''}` : err.message || 'Request failed');
  }
}

/** Resizes an image in the browser (keeps uploads small for slow phones), uploads to /public, returns its URL. */
export async function uploadImage(file: File, name: string, maxSize = 1200): Promise<string> {
  init();
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // QR codes / logos with transparency stay readable
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // PNG keeps QR edges crisp; photos go to WebP.
  const type = name.startsWith('qr') ? 'image/png' : 'image/webp';
  const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), type, 0.85));
  const r = ref(storage, `public/${name}-${Date.now()}.${type === 'image/png' ? 'png' : 'webp'}`);
  await uploadBytes(r, blob, { contentType: type, cacheControl: 'public,max-age=31536000' });
  return getDownloadURL(r);
}
