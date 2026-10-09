'use client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, type Firestore } from 'firebase/firestore';
import { errorMessages, type BookingErrorCode } from '@temple/shared';

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

let app: FirebaseApp, db: Firestore, auth: Auth;

function init() {
  if (app) return;
  app = getApps()[0] ?? initializeApp(config);
  db = getFirestore(app);
  auth = getAuth(app);
  if (process.env.NEXT_PUBLIC_USE_EMULATORS === 'true') {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
  }
}

export const getDb = () => (init(), db);
export const getAuthInstance = () => (init(), auth);

/** Calls an admin server function (POST /api/<name>, run by Vercel); the server re-checks the admin claim on every call. */
export async function callAdmin<I, O = { ok: boolean }>(name: string, data: I): Promise<O> {
  init();
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in');
  const token = await user.getIdToken();
  let res: Response;
  try {
    res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(data ?? {}),
    });
  } catch {
    throw new Error('Network error — check the connection and try again');
  }
  const body = (await res.json().catch(() => ({}))) as { data?: O; error?: { code?: string; message?: string } };
  if (res.ok) return body.data as O;
  const code = body.error?.code as BookingErrorCode | undefined;
  const msg = body.error?.message;
  throw new Error(code && errorMessages[code] ? `${errorMessages[code].en}${msg && msg !== code ? ` (${msg})` : ''}` : msg || 'Request failed');
}

/** Fire-and-forget audit entry for a configuration edit made directly from the dashboard. */
export function auditConfig(collection: string, docId: string, action: 'create' | 'update' | 'delete', changed?: Record<string, unknown>) {
  // Image data URLs are large — the log only needs to know they changed.
  const slim = changed && Object.fromEntries(Object.entries(changed).map(([k, v]) => [k, typeof v === 'string' && v.startsWith('data:') ? '(image)' : v]));
  callAdmin('adminAudit', { collection, docId, action, changed: slim }).catch(() => { /* audit must never block the edit */ });
}

/** Byte budget per image: settings/public is one Firestore document (1 MiB max) and every visitor downloads it. */
const IMAGE_BUDGET: Record<string, number> = { logo: 60_000, hero: 320_000, qr: 160_000 };

/**
 * Resizes an image in the browser and returns it as a data URL, which is saved straight into Firestore
 * (Firebase Storage needs the Blaze plan). Quality is lowered until the image fits its byte budget.
 */
export async function uploadImage(file: File, name: string, maxSize = 1200): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff'; // QR codes / logos with transparency stay readable
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  // PNG keeps QR edges crisp; everything else goes to WebP.
  const isQr = name.startsWith('qr');
  const budget = IMAGE_BUDGET[name] ?? 250_000;
  let quality = 0.85;
  for (let attempt = 0; attempt < 6; attempt++) {
    const url = canvas.toDataURL(isQr ? 'image/png' : 'image/webp', quality);
    if (url.length <= budget || isQr) {
      if (url.length > budget) {
        // A QR that is still too big: shrink it instead of lowering quality.
        const c2 = document.createElement('canvas');
        const f = Math.sqrt(budget / url.length) * 0.95;
        c2.width = Math.max(300, Math.round(canvas.width * f));
        c2.height = Math.max(300, Math.round(canvas.height * f));
        c2.getContext('2d')!.drawImage(canvas, 0, 0, c2.width, c2.height);
        return c2.toDataURL('image/png');
      }
      return url;
    }
    quality -= 0.15;
  }
  throw new Error('Image is too large even after compression — use a smaller picture');
}
