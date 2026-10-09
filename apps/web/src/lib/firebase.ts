'use client';
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, connectAuthEmulator, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updateProfile, signOut, type Auth, type User,
} from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
  type Firestore,
} from 'firebase/firestore';
import { errorMessages, mobileFromEmail, normalizeMobile, phoneEmail, t, type BookingErrorCode, type Lang, type StringKey } from '@temple/shared';

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

let app: FirebaseApp, db: Firestore, auth: Auth;

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
  if (useEmulators) {
    connectFirestoreEmulator(db, 'localhost', 8080);
    connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
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

/** Devotees sign in with mobile number + password (Firebase stores it under a derived email, see phoneEmail). */
export function signIn(mobile: string, password: string) {
  init();
  const m = normalizeMobile(mobile);
  if (!m) return Promise.reject({ code: 'auth/invalid-mobile' });
  return signInWithEmailAndPassword(auth, phoneEmail(m), password);
}

const MOBILE_KEY = 'profileMobile';
/** Creates the account; the name lives on the Firebase profile and the mobile number pre-fills the booking form. */
export async function signUp(input: { name: string; password: string; mobile: string }): Promise<User> {
  init();
  const m = normalizeMobile(input.mobile);
  if (!m) throw { code: 'auth/invalid-mobile' };
  const cred = await createUserWithEmailAndPassword(auth, phoneEmail(m), input.password);
  await updateProfile(cred.user, { displayName: input.name.trim() });
  try { localStorage.setItem(MOBILE_KEY, m); } catch { /* private mode */ }
  return cred.user;
}
/** The mobile number of the signed-in devotee (from the account), or the last one used on this device. */
export function userMobile(user: User | null | undefined): string {
  return mobileFromEmail(user?.email) ?? savedMobile();
}
export function savedMobile(): string {
  try { return localStorage.getItem(MOBILE_KEY) ?? ''; } catch { return ''; }
}
export function rememberMobile(mobile: string) {
  try { localStorage.setItem(MOBILE_KEY, mobile); } catch { /* ignore */ }
}

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
  if (code.includes('invalid-mobile')) return 'err_mobile';
  if (code.includes('invalid-email')) return 'err_mobile';
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

/** Calls a server function (POST /api/<name>, run by Vercel) and turns failures into a translated message. */
export async function callFn<I, O>(name: string, data: I, lang: Lang): Promise<O> {
  let res: Response;
  try {
    const user = await ensureUser();
    const token = await user.getIdToken();
    res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify(data ?? {}),
    });
  } catch {
    throw new AppError('OFFLINE', t('err_offline', lang));
  }
  const body = (await res.json().catch(() => ({}))) as { data?: O; error?: { code?: string; message?: string } };
  if (res.ok) return body.data as O;
  const code = body.error?.code as BookingErrorCode | undefined;
  if (code && errorMessages[code]) throw new AppError(code, errorMessages[code][lang]);
  throw new AppError('UNKNOWN', t('err_generic', lang));
}
