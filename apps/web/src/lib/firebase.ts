'use client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile, signOut, type Auth, type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator, type Functions } from 'firebase/functions';
import { FUNCTIONS_REGION, errorMessages, t, type BookingErrorCode, type Lang, type StringKey } from '@temple/shared';

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

/* ------------------------------ customer accounts (email + password) ------------------------------ */

/** Subscribe to the signed-in devotee. Anonymous sessions left over from the old app are signed out. */
export function onUser(cb: (u: User | null) => void): () => void {
  init();
  return onAuthStateChanged(auth, (u) => {
    if (u?.isAnonymous) { signOut(auth).catch(() => {}); cb(null); return; }
    cb(u);
  });
}

/** Resolves the signed-in devotee (the UI never calls the backend while signed out). */
export function ensureUser(): Promise<User> {
  init();
  if (auth.currentUser && !auth.currentUser.isAnonymous) return Promise.resolve(auth.currentUser);
  return new Promise<User>((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, (u) => {
      unsub();
      if (u && !u.isAnonymous) resolve(u);
      else reject(new Error('auth/not-signed-in'));
    });
  });
}

export const signIn = (email: string, password: string) => (init(), signInWithEmailAndPassword(auth, email.trim(), password));

const MOBILE_KEY = 'profileMobile';
/** Creates the account and keeps the name on the Firebase profile; the mobile number pre-fills the booking form. */
export async function signUp(input: { name: string; email: string; password: string; mobile: string }): Promise<User> {
  init();
  const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  await updateProfile(cred.user, { displayName: input.name.trim() });
  try { localStorage.setItem(MOBILE_KEY, input.mobile); } catch { /* private mode */ }
  return cred.user;
}
export function savedMobile(): string {
  try { return localStorage.getItem(MOBILE_KEY) ?? ''; } catch { return ''; }
}
export function rememberMobile(mobile: string) {
  try { localStorage.setItem(MOBILE_KEY, mobile); } catch { /* ignore */ }
}

export const resetPassword = (email: string) => (init(), sendPasswordResetEmail(auth, email.trim()));

export async function signOutUser(): Promise<void> {
  init();
  await signOut(auth);
}

/** Maps a Firebase Auth error to a translated message key. */
export function authErrorKey(e: unknown): StringKey {
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('invalid-login-credentials')) return 'err_wrongPassword';
  if (code.includes('user-not-found')) return 'err_userNotFound';
  if (code.includes('email-already-in-use')) return 'err_emailInUse';
  if (code.includes('invalid-email')) return 'err_email';
  if (code.includes('weak-password')) return 'err_password';
  if (code.includes('too-many-requests')) return 'err_tooMany';
  if (code.includes('network-request-failed')) return 'err_offline';
  return 'err_generic';
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
