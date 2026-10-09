/**
 * Replaces functions/src/triggers.ts.
 *  - afterStatusChange(): what the `onBookingUpdated` Firestore trigger did — called explicitly by every
 *    operation that changes a booking's status (payment verified/rejected, cancellation, hold expiry).
 *  - expireHolds() / completeBookings(): the scheduled jobs. Without a scheduler they run opportunistically
 *    (runMaintenance() is called when a booking is created and when the admin dashboard opens, throttled
 *    to once every few minutes) and from a daily cron as a backstop.
 */
import type { Timestamp as TS } from 'firebase-admin/firestore';
import { db, FieldValue, Timestamp } from './core';
import { cancelInTx, ownsTxnLock } from './bookings';
import { bookingMessages, pushToUsers } from './notify';
import type { Booking } from '@temple/shared';

type Status = Pick<Booking, 'bookingStatus' | 'paymentStatus'>;

/** Mirrors the new status onto families/groups and notifies the devotee. Call AFTER the transaction committed. */
export async function afterStatusChange(bookingId: string, before: Status): Promise<void> {
  const snap = await db.doc(`bookings/${bookingId}`).get();
  const after = snap.data() as Booking | undefined;
  if (!after) return;
  if (before.bookingStatus === after.bookingStatus && before.paymentStatus === after.paymentStatus) return;

  const patch = { bookingStatus: after.bookingStatus, paymentStatus: after.paymentStatus };
  const batch = db.batch();
  const fams = await db.collection('families').where('bookingId', '==', after.bookingId).get();
  fams.forEach((d) => batch.update(d.ref, patch));
  if (after.bookingType === 'group') batch.set(db.doc(`groups/${after.bookingId}`), patch, { merge: true });

  let msg: { title: { ta: string; en: string }; body: { ta: string; en: string } } | null = null;
  if (after.bookingStatus === 'confirmed' && before.bookingStatus !== 'confirmed') msg = bookingMessages.confirmed(after.bookingId);
  else if (after.paymentStatus === 'rejected' && before.paymentStatus !== 'rejected') msg = bookingMessages.rejected(after.bookingId);
  else if (after.bookingStatus === 'cancelled' && before.bookingStatus !== 'cancelled') msg = bookingMessages.cancelled(after.bookingId);

  if (msg) {
    batch.set(db.collection('notifications').doc(), {
      audience: 'user', type: 'booking_update', ...msg, bookingId: after.bookingId,
      userIds: after.viewerUids ?? [], createdAt: FieldValue.serverTimestamp(), createdBy: null,
    });
  }
  await batch.commit();
  if (msg) {
    try { await pushToUsers(after.viewerUids ?? [], msg.title, msg.body, { bookingId: after.bookingId }); } catch (e) { console.warn('push failed', e); }
  }
}

/** Releases places held by bookings that were never paid (or whose rejected payment was never resubmitted). */
export async function expireHolds(): Promise<number> {
  const due = await db.collection('bookings')
    .where('bookingStatus', '==', 'pending')
    .where('holdExpiresAt', '<=', Timestamp.now())
    .limit(200)
    .get();
  let released = 0;
  for (const doc of due.docs) {
    try {
      let before: Status | null = null;
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const b = snap.data() as Booking | undefined;
        const hold = b?.holdExpiresAt as unknown as TS | null;
        if (!b || b.bookingStatus !== 'pending' || b.paymentSubmitted || !hold || hold.toMillis() > Date.now()) return;
        const owns = await ownsTxnLock(tx, b);
        before = { bookingStatus: b.bookingStatus, paymentStatus: b.paymentStatus };
        cancelInTx(tx, snap, b.paymentStatus === 'rejected' ? 'Payment not resubmitted in time' : 'Payment not received in time', { cancelledBy: 'system' }, owns);
      });
      if (before) { released++; await afterStatusChange(doc.id, before); }
    } catch (e) {
      console.error('expireHolds failed for one booking', doc.id, e); // keep going with the rest
    }
  }
  return released;
}

/** Moves confirmed bookings to "completed" a few hours after their slot. */
export async function completeBookings(): Promise<number> {
  const cutoff = Timestamp.fromMillis(Date.now() - 3 * 3600_000);
  const due = await db.collection('bookings')
    .where('bookingStatus', '==', 'confirmed')
    .where('slotStartAt', '<=', cutoff)
    .limit(450)
    .get();
  let done = 0;
  for (const d of due.docs) {
    try {
      // Precondition: skip if the booking changed (e.g. was cancelled) after the query.
      await d.ref.update({ bookingStatus: 'completed', completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { lastUpdateTime: d.updateTime });
      done++;
      await afterStatusChange(d.id, { bookingStatus: 'confirmed', paymentStatus: 'paid' });
    } catch {
      /* changed concurrently — next run re-evaluates */
    }
  }
  return done;
}

const MIN_INTERVAL_MS = 3 * 60_000;

/**
 * Runs the housekeeping jobs at most once per MIN_INTERVAL_MS across all server instances
 * (a Firestore doc acts as the lock). `force` is for the cron endpoint.
 */
export async function runMaintenance(force = false): Promise<{ ran: boolean; released?: number; completed?: number }> {
  const ref = db.doc('maintenance/status');
  const now = Date.now();
  const claimed = await db.runTransaction(async (tx) => {
    const last = ((await tx.get(ref)).data()?.lastRunAt as number | undefined) ?? 0;
    if (!force && now - last < MIN_INTERVAL_MS) return false;
    tx.set(ref, { lastRunAt: now }, { merge: true });
    return true;
  });
  if (!claimed) return { ran: false };
  const released = await expireHolds();
  const completed = await completeBookings();
  await ref.set({ lastResult: { released, completed, at: FieldValue.serverTimestamp() } }, { merge: true });
  return { ran: true, released, completed };
}
