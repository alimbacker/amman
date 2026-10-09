import { onCall } from 'firebase-functions/v2/https';
import { db, FieldValue, getSettings, messaging, rateLimit, requireAdmin, requireUser, auditEntry } from './core';
import { cancelInTx, createBookingCore, guard, ownsTxnLock } from './bookings';
import {
  RuleError,
  cancelBlocker,
  createBookingSchema,
  lookupSchema,
  normalizeBooking,
  normalizeTxnOrThrow,
  parse,
  paymentSubmitBlocker,
  submitPaymentSchema,
  verifyBlocker,
} from './logic';
import { z } from 'zod';
import { pushToAll, pushToUsers } from './notify';
import { normalizeMobile } from './shared/utils';
import type { Booking } from './shared/model';
import type { CallableRequest } from 'firebase-functions/v2/https';

/** Max UTR submissions per booking (first try + 2 corrections). */
const MAX_PAYMENT_ATTEMPTS = 3;

function clientIp(req: CallableRequest): string {
  const fwd = String(req.rawRequest?.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim();
  return (fwd || req.rawRequest?.ip || 'unknown').replace(/[^0-9a-fA-F.:]/g, '').slice(0, 45) || 'unknown';
}

const opts = { enforceAppCheck: process.env.ENFORCE_APP_CHECK === 'true' };

function holdMs(b: Booking): number | null {
  const h = b.holdExpiresAt as unknown as FirebaseFirestore.Timestamp | null;
  return h ? h.toMillis() : null;
}

/* ============================ customer ============================ */

/** Step "Proceed to payment": reserves the place and returns the booking ID + amount. */
export const createBooking = onCall(opts, (req) =>
  guard(async () => {
    const uid = requireUser(req);
    await rateLimit(`create_${uid}`, 10, 3600);
    await rateLimit(`create_ip_${clientIp(req)}`, 40, 3600); // anonymous uids are free; IPs are not
    const settings = await getSettings();
    const input = normalizeBooking(parse(createBookingSchema, req.data), settings.maxMembersPerBooking || 25);
    return createBookingCore(input, { uid, source: 'online', paymentMode: 'upi' });
  }),
);

/** Step "Submit booking": attaches the UPI transaction ID; status → Pending Verification. */
export const submitPayment = onCall(opts, (req) =>
  guard(async () => {
    const uid = requireUser(req);
    await rateLimit(`pay_${uid}`, 15, 3600);
    await rateLimit(`pay_ip_${clientIp(req)}`, 60, 3600);
    const data = parse(submitPaymentSchema, req.data);
    const mobile = normalizeMobile(data.mobileNumber);
    const txnId = normalizeTxnOrThrow(data.transactionId);
    if (!mobile) throw new RuleError('INVALID_INPUT', 'mobileNumber: invalid');

    return db.runTransaction(async (tx) => {
      const ref = db.doc(`bookings/${data.bookingId.toUpperCase()}`);
      const txnRef = db.doc(`paymentTxnIds/${txnId}`);
      const [snap, txnSnap] = await tx.getAll(ref, txnRef);
      const b = snap.data() as Booking | undefined;
      // Same error for "missing" and "wrong mobile" so IDs cannot be probed.
      if (!b || b.mobileNumber !== mobile) throw new RuleError('NOT_FOUND');
      const blocker = paymentSubmitBlocker({ ...b, holdExpiresMs: holdMs(b) }, Date.now());
      if (blocker) throw new RuleError(blocker);
      const slotStart = (b.slotStartAt as unknown as FirebaseFirestore.Timestamp | null)?.toMillis() ?? Infinity;
      if (slotStart <= Date.now()) throw new RuleError('SLOT_CLOSED', 'slot has started');
      const attempts = Number((b as Booking & { paymentAttempts?: number }).paymentAttempts ?? 0);
      if (attempts >= MAX_PAYMENT_ATTEMPTS) throw new RuleError('NOT_ALLOWED', 'too many payment attempts');
      if (txnSnap.exists && txnSnap.get('bookingId') !== b.bookingId) throw new RuleError('DUPLICATE_TXN');

      const now = FieldValue.serverTimestamp();
      const payRef = db.collection('payments').doc();
      tx.set(txnRef, { bookingId: b.bookingId, createdAt: now });
      tx.set(payRef, {
        bookingId: b.bookingId,
        transactionId: txnId,
        amountEntered: data.amount,
        expectedAmount: b.amount,
        amountMismatch: Math.round(data.amount) !== Math.round(b.amount),
        mobileNumber: b.mobileNumber,
        contactName: b.contactName,
        festivalId: b.festivalId,
        status: 'pending',
        mode: 'upi',
        submittedAt: now,
        verifiedAt: null,
        verifiedBy: null,
        reason: null,
      });
      tx.update(ref, {
        transactionId: txnId,
        amountPaid: data.amount,
        paymentSubmitted: true,
        paymentStatus: 'pending',
        paymentSubmittedAt: now,
        paymentId: payRef.id,
        paymentAttempts: FieldValue.increment(1),
        holdExpiresAt: null,
        rejectionReason: null,
        viewerUids: FieldValue.arrayUnion(uid),
        updatedAt: now,
      });
      tx.set(db.collection('notifications').doc(), {
        audience: 'admin',
        type: 'payment_submitted',
        title: { ta: 'புதிய கட்டணம் சரிபார்க்க', en: 'New payment to verify' },
        body: { ta: `${b.bookingId} · ${b.contactName} · ₹${data.amount}`, en: `${b.bookingId} · ${b.contactName} · ₹${data.amount}` },
        bookingId: b.bookingId,
        userIds: [],
        createdAt: now,
        createdBy: null,
      });
      return { bookingId: b.bookingId, paymentStatus: 'pending' };
    });
  }),
);

/** "Find booking" on another device: proves ownership with ID + mobile, then grants read access. */
export const lookupBooking = onCall(opts, (req) =>
  guard(async () => {
    const uid = requireUser(req);
    await rateLimit(`lookup_${uid}`, 10, 3600);
    await rateLimit(`lookup_ip_${clientIp(req)}`, 30, 3600);
    const data = parse(lookupSchema, req.data);
    const mobile = normalizeMobile(data.mobileNumber);
    // Per-mobile limit stops walking sequential booking IDs for a known number.
    if (mobile) await rateLimit(`lookup_m_${mobile}`, 8, 3600);
    const ref = db.doc(`bookings/${data.bookingId.trim().toUpperCase()}`);
    const snap = await ref.get();
    if (!mobile || !snap.exists || snap.get('mobileNumber') !== mobile) throw new RuleError('NOT_FOUND');
    await ref.update({ viewerUids: FieldValue.arrayUnion(uid) });
    return { bookingId: snap.id };
  }),
);

/** Stores the device's FCM token and subscribes it to announcements in the chosen language. */
export const registerDevice = onCall(opts, (req) =>
  guard(async () => {
    const uid = requireUser(req);
    await rateLimit(`device_${uid}`, 20, 3600);
    const { token, lang } = parse(z.object({ token: z.string().min(10).max(4096), lang: z.enum(['ta', 'en']) }), req.data);
    const ref = db.doc(`users/${uid}`);
    await db.runTransaction(async (tx) => {
      const tokens = ((await tx.get(ref)).get('fcmTokens') as string[] | undefined) ?? [];
      const next = [...tokens.filter((t) => t !== token), token].slice(-10); // keep the 10 newest devices
      tx.set(ref, { fcmTokens: next, lang, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    });
    const other = lang === 'ta' ? 'en' : 'ta';
    await messaging().subscribeToTopic([token], `announcements_${lang}`);
    await messaging().unsubscribeFromTopic([token], `announcements_${other}`);
    return { ok: true };
  }),
);

/* ============================ admin ============================ */

export const adminCreateBooking = onCall(opts, (req) =>
  guard(async () => {
    const admin = requireAdmin(req);
    const settings = await getSettings();
    const extra = parse(
      z.object({ paymentMode: z.enum(['upi', 'cash', 'later']), transactionId: z.string().max(60).optional() }),
      { paymentMode: req.data?.paymentMode, transactionId: req.data?.transactionId || undefined },
    );
    const input = normalizeBooking(parse(createBookingSchema, req.data), Math.max(settings.maxMembersPerBooking || 25, 100));
    const txnId = extra.paymentMode === 'upi' && extra.transactionId ? normalizeTxnOrThrow(extra.transactionId) : null;
    if (extra.paymentMode === 'upi' && !txnId) throw new RuleError('INVALID_INPUT', 'transactionId required for UPI');
    return createBookingCore(input, { uid: null, source: 'admin', paymentMode: extra.paymentMode, transactionId: txnId, admin });
  }),
);

export const adminVerifyPayment = onCall(opts, (req) =>
  guard(async () => {
    const admin = requireAdmin(req);
    const data = parse(
      z.object({ bookingId: z.string().min(3).max(40), action: z.enum(['approve', 'reject', 'cash']), reason: z.string().trim().max(300).optional() }),
      req.data,
    );
    if (data.action === 'reject' && !data.reason) throw new RuleError('INVALID_INPUT', 'reason required');
    const settings = await getSettings();

    return db.runTransaction(async (tx) => {
      const ref = db.doc(`bookings/${data.bookingId}`);
      const snap = await tx.get(ref);
      const b = snap.data() as (Booking & { paymentId?: string; paymentAttempts?: number }) | undefined;
      if (!b) throw new RuleError('NOT_FOUND');
      const blocker = verifyBlocker({ ...b, holdExpiresMs: null }, data.action);
      if (blocker) throw new RuleError(blocker);
      // reads first: UTR reservation state
      const txnRef = b.transactionId ? db.doc(`paymentTxnIds/${b.transactionId}`) : null;
      const txnSnap = txnRef ? await tx.get(txnRef) : null;
      const owns = !!txnSnap?.exists && txnSnap.get('bookingId') === b.bookingId;

      const now = FieldValue.serverTimestamp();
      const by = admin.email ?? admin.uid;
      const audit = (action: string, extra: Record<string, unknown> = {}) =>
        tx.set(db.collection('auditLogs').doc(), auditEntry(action, `bookings/${b.bookingId}`, admin, {
          transactionId: b.transactionId, amount: b.amount, amountPaid: b.amountPaid, reason: data.reason ?? null, ...extra,
        }));

      if (data.action === 'cash') {
        // Paid at the temple counter.
        const payRef = db.collection('payments').doc();
        tx.set(payRef, {
          bookingId: b.bookingId, transactionId: `CASH-${b.bookingId}`, amountEntered: b.amount, expectedAmount: b.amount,
          mobileNumber: b.mobileNumber, contactName: b.contactName, festivalId: b.festivalId, status: 'paid', mode: 'cash',
          submittedAt: now, verifiedAt: now, verifiedBy: by, reason: data.reason ?? null,
        });
        if (b.paymentId && b.paymentStatus === 'pending' && b.paymentSubmitted) {
          tx.update(db.doc(`payments/${b.paymentId}`), { status: 'rejected', reason: 'Settled in cash', verifiedAt: now, verifiedBy: by });
        }
        if (owns && txnRef) tx.delete(txnRef);
        tx.update(ref, {
          paymentStatus: 'paid', bookingStatus: 'confirmed', paymentSubmitted: true, paymentMode: 'cash', paymentId: payRef.id,
          transactionId: null, amountPaid: b.amount, confirmedAt: now, verifiedBy: by, holdExpiresAt: null, rejectionReason: null, updatedAt: now,
        });
        audit('payment.cash');
        return { ok: true };
      }

      if (data.action === 'approve') {
        // Approving after a reject: the UTR must still be ours (or free) — re-reserve it.
        if (txnRef && !owns) {
          if (txnSnap?.exists) throw new RuleError('DUPLICATE_TXN');
          tx.set(txnRef, { bookingId: b.bookingId, createdAt: now });
        }
        tx.update(ref, {
          paymentStatus: 'paid', bookingStatus: 'confirmed', paymentSubmitted: true,
          confirmedAt: now, verifiedBy: by, holdExpiresAt: null, rejectionReason: null, updatedAt: now,
        });
        if (b.paymentId) tx.update(db.doc(`payments/${b.paymentId}`), { status: 'paid', verifiedAt: now, verifiedBy: by, reason: null });
        audit('payment.approve');
        return { ok: true };
      }

      // reject — release the UTR so a mistyped number cannot block its real owner
      if (owns && txnRef) tx.delete(txnRef);
      if (b.paymentId) tx.update(db.doc(`payments/${b.paymentId}`), { status: 'rejected', verifiedAt: now, verifiedBy: by, reason: data.reason ?? null });
      if ((b.paymentAttempts ?? 1) >= MAX_PAYMENT_ATTEMPTS) {
        // Out of attempts: give the place back.
        cancelInTx(tx, snap, `Payment rejected: ${data.reason}`, { cancelledBy: by, paymentStatus: 'rejected', rejectionReason: data.reason }, false);
        audit('payment.reject', { cancelled: true });
        return { ok: true, cancelled: true };
      }
      // Grace to resubmit: 12h (at least the hold time), never past the slot start.
      const slotStart = (b.slotStartAt as unknown as FirebaseFirestore.Timestamp | null)?.toMillis() ?? Infinity;
      const graceUntil = Math.min(Date.now() + Math.max(12 * 60, settings.holdMinutes || 30) * 60_000, slotStart);
      tx.update(ref, {
        paymentStatus: 'rejected', paymentSubmitted: false, rejectionReason: data.reason,
        rejectedAt: now, verifiedBy: by, holdExpiresAt: new Date(graceUntil), updatedAt: now,
      });
      audit('payment.reject');
      return { ok: true };
    });
  }),
);

export const adminCancelBooking = onCall(opts, (req) =>
  guard(async () => {
    const admin = requireAdmin(req);
    const data = parse(z.object({ bookingId: z.string().min(3).max(40), reason: z.string().trim().min(2).max(300) }), req.data);
    return db.runTransaction(async (tx) => {
      const snap = await tx.get(db.doc(`bookings/${data.bookingId}`));
      const b = snap.data() as (Booking & { paymentId?: string }) | undefined;
      if (!b) throw new RuleError('NOT_FOUND');
      const blocker = cancelBlocker(b);
      if (blocker) throw new RuleError(blocker);
      const owns = await ownsTxnLock(tx, b);
      cancelInTx(tx, snap, data.reason, { cancelledBy: admin.email ?? admin.uid }, owns);
      if (b.paymentId && b.paymentStatus === 'pending' && b.paymentSubmitted) {
        tx.update(db.doc(`payments/${b.paymentId}`), { status: 'rejected', reason: `Booking cancelled: ${data.reason}` });
      }
      tx.set(db.collection('auditLogs').doc(), auditEntry('booking.cancel', `bookings/${b.bookingId}`, admin, {
        reason: data.reason, paymentStatus: b.paymentStatus, amount: b.amount,
      }));
      return { ok: true, refundDue: b.paymentStatus === 'paid' };
    });
  }),
);

const bilingual = z.object({ ta: z.string().trim().max(200), en: z.string().trim().max(200) });

export const adminSendNotification = onCall(opts, (req) =>
  guard(async () => {
    const admin = requireAdmin(req);
    const data = parse(
      z.object({ title: bilingual, body: bilingual.extend({ ta: z.string().max(1000), en: z.string().max(1000) }), target: z.enum(['all', 'booking']), bookingId: z.string().max(40).optional() }),
      req.data,
    );
    if (!data.title.ta && !data.title.en) throw new RuleError('INVALID_INPUT', 'title required');
    let userIds: string[] = [];
    if (data.target === 'booking') {
      const snap = await db.doc(`bookings/${data.bookingId ?? '_'}`).get();
      if (!snap.exists) throw new RuleError('NOT_FOUND');
      userIds = (snap.get('viewerUids') as string[]) ?? [];
      await pushToUsers(userIds, data.title, data.body, { bookingId: snap.id });
    } else {
      await pushToAll(data.title, data.body);
    }
    const batch = db.batch();
    batch.set(db.collection('notifications').doc(), {
      audience: data.target === 'all' ? 'all' : 'user', type: 'announcement', title: data.title, body: data.body,
      bookingId: data.bookingId ?? null, userIds, createdAt: FieldValue.serverTimestamp(), createdBy: admin.email ?? admin.uid,
    });
    batch.set(db.collection('auditLogs').doc(), auditEntry('notification.send', data.target, admin, { title: data.title.en || data.title.ta }));
    await batch.commit();
    return { ok: true, recipients: data.target === 'all' ? 'topic' : userIds.length };
  }),
);
