'use client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signOut, onAuthStateChanged, connectAuthEmulator, type Auth, type User } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { FUNCTIONS_REGION, errorMessages, t, type BookingErrorCode, type Lang } from '@temple/shared';

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
const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === 'true';

let app: FirebaseApp, db: Firestore, auth: Auth, fns: Functions;

function init() {
  if (app) return;
  app = getApps()[0] ?? initializeApp(config);
  // Persistent cache → instant repeat visits and resilience on slow mobile networks.
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch {
    db = initializeFirestore(app, {});
  }
  auth = getAuth(app);
  fns = getFunctions(app, FUNCTIONS_REGION);
  if (useEmulators) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
    connectFunctionsEmulator(fns, 'localhost', 5001);
  }
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (siteKey) {
    import('firebase/app-check').then(({ initializeAppCheck, ReCaptchaEnterpriseProvider }) =>
      initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(siteKey), isTokenAutoRefreshEnabled: true }),
    );
  }
}

export function getDb(): Firestore {
  init();
  return db;
}

let userPromise: Promise<User> | null = null;
/** Devotees never create accounts — each device gets a silent anonymous identity. */
export function ensureUser(): Promise<User> {
  init();
  if (!userPromise) {
    userPromise = new Promise<User>((resolve, reject) => {
      const unsub = onAuthStateChanged(auth, async (u) => {
        unsub();
        try {
          resolve(u ?? (await signInAnonymously(auth)).user);
        } catch (e) {
          userPromise = null;
          reject(e);
        }
      });
    });
  }
  return userPromise;
}

/** Drops this device's anonymous identity so its bookings are no longer listed here (shared phones). */
export async function forgetDevice(): Promise<void> {
  init();
  await signOut(auth);
  userPromise = null;
}

export class AppError extends Error {
  constructor(public code: BookingErrorCode | 'OFFLINE' | 'UNKNOWN', message: string) {
    super(message);
  }
}

/** Calls a Cloud Function and turns failures into a translated message. */
export async function callFn<I, O>(name: string, data: I, lang: Lang): Promise<O> {
  try {
    await ensureUser();
    const res = await httpsCallable<I, O>(fns, name, { timeout: 30_000 })(data);
    return res.data;
  } catch (e: unknown) {
    const err = e as { code?: string; details?: { code?: BookingErrorCode } };
    const code = err.details?.code;
    if (code && errorMessages[code]) throw new AppError(code, errorMessages[code][lang]);
    if (err.code === 'functions/unavailable' || err.code === 'functions/deadline-exceeded' || (typeof navigator !== 'undefined' && !navigator.onLine)) {
      throw new AppError('OFFLINE', t('err_offline', lang));
    }
    throw new AppError('UNKNOWN', t('err_generic', lang));
  }
}
