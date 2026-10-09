import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { getAuth } from 'firebase-admin/auth';
import { HttpsError, type CallableRequest, type FunctionsErrorCode } from 'firebase-functions/v2/https';
import type { BookingErrorCode, TempleSettings } from './shared/model';

if (!getApps().length) initializeApp();

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });
export const messaging = () => getMessaging();
export const auth = () => getAuth();
export { FieldValue, Timestamp };

const httpCode: Record<BookingErrorCode, FunctionsErrorCode> = {
  SLOT_FULL: 'resource-exhausted',
  SLOT_CLOSED: 'failed-precondition',
  BOOKING_CLOSED: 'failed-precondition',
  DUPLICATE_BOOKING: 'already-exists',
  DUPLICATE_TXN: 'already-exists',
  HOLD_EXPIRED: 'deadline-exceeded',
  NOT_FOUND: 'not-found',
  INVALID_STATE: 'failed-precondition',
  TOO_MANY_HOLDS: 'resource-exhausted',
  RATE_LIMITED: 'resource-exhausted',
  INVALID_INPUT: 'invalid-argument',
  NOT_ALLOWED: 'permission-denied',
};

/** Throws an HttpsError whose details.code is a BookingErrorCode the clients can translate. */
export function fail(code: BookingErrorCode, message?: string): never {
  throw new HttpsError(httpCode[code], message ?? code, { code });
}

export function requireUser(req: CallableRequest): string {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Sign-in required');
  return req.auth.uid;
}

export function requireAdmin(req: CallableRequest): { uid: string; email: string | null } {
  if (!req.auth?.uid || req.auth.token.admin !== true) {
    throw new HttpsError('permission-denied', 'Admin only', { code: 'NOT_ALLOWED' });
  }
  return { uid: req.auth.uid, email: (req.auth.token.email as string) ?? null };
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
 * Cheap protection against scripted abuse of the public callables.
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
