/**
 * Server-side Firebase (Admin SDK) for the Next.js API routes on Vercel.
 * Replaces functions/src/core.ts — same helpers, but errors are HTTP responses and the
 * caller is identified from a Firebase ID token instead of a callable context.
 *
 * Credentials: set FIREBASE_SERVICE_ACCOUNT (the service-account JSON, as one line) in the
 * hosting provider's environment variables. Locally, GOOGLE_APPLICATION_CREDENTIALS works too.
 */
import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import type { BookingErrorCode, TempleSettings } from '@temple/shared';

function app(): App {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (raw) {
    const sa = JSON.parse(raw) as { project_id: string; client_email: string; private_key: string };
    return initializeApp({ credential: cert({ projectId: sa.project_id, clientEmail: sa.client_email, privateKey: sa.private_key.replace(/\\n/g, '\n') }), projectId: sa.project_id });
  }
  return initializeApp({ credential: applicationDefault(), projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
}

let _db: Firestore | null = null;
export function getDb(): Firestore {
  if (!_db) {
    _db = getFirestore(app());
    try { _db.settings({ ignoreUndefinedProperties: true }); } catch { /* already configured */ }
  }
  return _db;
}
/** Lazy proxy so modules can keep writing `db.doc(...)` as in the Cloud Functions code. */
export const db: Firestore = new Proxy({} as Firestore, {
  get: (_t, p) => {
    const real = getDb() as unknown as Record<PropertyKey, unknown>;
    const v = real[p];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});
export const messaging = () => getMessaging(app());
export const auth = () => getAuth(app());
export { FieldValue, Timestamp };

const httpStatus: Record<BookingErrorCode, number> = {
  SLOT_FULL: 409, SLOT_CLOSED: 412, BOOKING_CLOSED: 412, DUPLICATE_BOOKING: 409, DUPLICATE_TXN: 409,
  HOLD_EXPIRED: 410, NOT_FOUND: 404, INVALID_STATE: 412, TOO_MANY_HOLDS: 429, RATE_LIMITED: 429,
  INVALID_INPUT: 400, NOT_ALLOWED: 403,
};

/** An error the clients can translate: `details.code` is a BookingErrorCode (or an auth code). */
export class ApiError extends Error {
  constructor(public status: number, public code: BookingErrorCode | 'UNAUTHENTICATED' | 'INTERNAL', message?: string) {
    super(message ?? code);
  }
}

export function fail(code: BookingErrorCode, message?: string): never {
  throw new ApiError(httpStatus[code], code, message ?? code);
}

/** Who is calling: decoded from `Authorization: Bearer <Firebase ID token>`. */
export interface Caller {
  uid: string | null;
  email: string | null;
  admin: boolean;
  ip: string;
}

export async function callerFromRequest(req: Request): Promise<Caller> {
  const fwd = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const ip = (fwd || 'unknown').replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45) || 'unknown';
  const header = req.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return { uid: null, email: null, admin: false, ip };
  try {
    const t = await auth().verifyIdToken(token);
    return { uid: t.uid, email: (t.email as string | undefined) ?? null, admin: t.admin === true, ip };
  } catch {
    return { uid: null, email: null, admin: false, ip };
  }
}

export function requireUser(c: Caller): string {
  if (!c.uid) throw new ApiError(401, 'UNAUTHENTICATED', 'Sign-in required');
  return c.uid;
}

export function requireAdmin(c: Caller): { uid: string; email: string | null } {
  if (!c.uid || !c.admin) throw new ApiError(403, 'NOT_ALLOWED', 'Admin only');
  return { uid: c.uid, email: c.email };
}

export const DEFAULT_SETTINGS: Pick<
  TempleSettings,
  'bookingOpen' | 'bookingPrefix' | 'holdMinutes' | 'capacityMode' | 'maxMembersPerBooking' | 'limitedThresholdPct' | 'timezone'
> = {
  bookingOpen: true,
  bookingPrefix: 'KA',
  holdMinutes: 30,
  capacityMode: 'bookings',
  maxMembersPerBooking: 25,
  limitedThresholdPct: 25,
  timezone: 'Asia/Kolkata',
};

export async function getSettings(): Promise<TempleSettings> {
  const snap = await db.doc('settings/public').get();
  return { ...DEFAULT_SETTINGS, ...(snap.data() ?? {}) } as TempleSettings;
}

/**
 * Fixed-window rate limit stored in rateLimits/{key}. Fails with RATE_LIMITED when exceeded.
 * Cheap protection against scripted abuse of the public endpoints.
 */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<void> {
  const ref = db.doc(`rateLimits/${key.replace(/\//g, '_')}`);
  const now = Date.now();
  const ok = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.data() as { windowStart: number; count: number } | undefined;
    if (!d || now - d.windowStart > windowSec * 1000) {
      tx.set(ref, { windowStart: now, count: 1, expireAt: Timestamp.fromMillis(now + windowSec * 1000 * 2) });
      return true;
    }
    if (d.count >= max) return false;
    tx.update(ref, { count: FieldValue.increment(1) });
    return true;
  });
  if (!ok) fail('RATE_LIMITED');
}

export function auditEntry(
  action: string,
  target: string,
  actor: { uid: string | null; email: string | null },
  details: Record<string, unknown> = {},
) {
  return {
    action,
    target,
    actorUid: actor.uid,
    actorEmail: actor.email,
    details,
    createdAt: FieldValue.serverTimestamp(),
  };
}
