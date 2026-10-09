import { logger } from 'firebase-functions/v2';
import { onDocumentUpdated, onDocumentWrittenWithAuthContext } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { auth, db, FieldValue, Timestamp, auditEntry } from './core';
import { cancelInTx, ownsTxnLock } from './bookings';
import { bookingMessages, pushToUsers } from './notify';
import type { Booking } from './shared/model';

/**
 * Keeps families/groups status in sync and notifies the devotee when the booking changes state.
 */
export const onBookingUpdated = onDocumentUpdated('bookings/{bookingId}', async (event) => {
  const before = event.data?.before.data() as Booking | undefined;
  const after = event.data?.after.data() as Booking | undefined;
  if (!before || !after) return;
  const statusChanged = before.bookingStatus !== after.bookingStatus || before.paymentStatus !== after.paymentStatus;
  if (!statusChanged) return;

  // 1) mirror status to normalised records
  const patch = { bookingStatus: after.bookingStatus, paymentStatus: after.paymentStatus };
  const batch = db.batch();
  const fams = await db.collection('families').where('bookingId', '==', after.bookingId).get();
  fams.forEach((d) => batch.update(d.ref, patch));
  if (after.bookingType === 'group') batch.set(db.doc(`groups/${after.bookingId}`), patch, { merge: true });

  // 2) notify
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
  if (msg) await pushToUsers(after.viewerUids ?? [], msg.title, msg.body, { bookingId: after.bookingId });
});

/** Audits admin edits to configuration collections (written directly from the dashboard). */
const emailCache = new Map<string, string | null>();
async function emailOf(uid: string): Promise<string | null> {
  if (!emailCache.has(uid)) {
    try { emailCache.set(uid, (await auth().getUser(uid)).email ?? null); } catch { emailCache.set(uid, null); }
  }
  return emailCache.get(uid) ?? null;
}

function configAudit(collection: string) {
  return onDocumentWrittenWithAuthContext(`${collection}/{docId}`, async (event) => {
    // Writes from Cloud Functions / scripts come from a service account — only audit end-user (admin) writes.
    if (!event.authId || event.authType === 'service_account' || event.authType === 'system') return;
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    const action = !before ? 'create' : !after ? 'delete' : 'update';
    const changed: Record<string, unknown> = {};
    if (before && after) {
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (JSON.stringify(before[k]) !== JSON.stringify(after[k]) && k !== 'updatedAt') changed[k] = after[k] ?? null;
      }
    }
    await db.collection('auditLogs').add(
      auditEntry(`${collection}.${action}`, `${collection}/${event.params.docId}`,
        { uid: event.authId, email: await emailOf(event.authId) },
        action === 'update' ? { changed: JSON.parse(JSON.stringify(changed)) } : {}),
    );
  });
}
export const auditSettings = configAudit('settings');
export const auditFestivals = configAudit('festivals');
export const auditDays = configAudit('festivalDays');
export const auditUbayam = configAudit('ubayamTypes');
export const auditSlots = configAudit('timeSlots');

/** Releases places held by bookings that were never paid (or whose rejected payment was never resubmitted). */
export const expireHolds = onSchedule({ schedule: 'every 5 minutes', timeZone: 'Asia/Kolkata' }, async () => {
  const due = await db.collection('bookings')
    .where('bookingStatus', '==', 'pending')
    .where('holdExpiresAt', '<=', Timestamp.now())
    .limit(200)
    .get();
  let released = 0;
  for (const doc of due.docs) {
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(doc.ref);
        const b = snap.data() as Booking | undefined;
        const hold = b?.holdExpiresAt as unknown as FirebaseFirestore.Timestamp | null;
        if (!b || b.bookingStatus !== 'pending' || b.paymentSubmitted || !hold || hold.toMillis() > Date.now()) return;
        const owns = await ownsTxnLock(tx, b);
        cancelInTx(tx, snap, b.paymentStatus === 'rejected' ? 'Payment not resubmitted in time' : 'Payment not received in time', { cancelledBy: 'system' }, owns);
        released++;
      });
    } catch (e) {
      logger.error('expireHolds failed for one booking', { id: doc.id, e }); // keep going with the rest
    }
  }
  if (released) logger.info(`expireHolds released ${released}`);
});

/** Moves confirmed bookings to "completed" a few hours after their slot. */
export const completeBookings = onSchedule({ schedule: 'every 60 minutes', timeZone: 'Asia/Kolkata' }, async () => {
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
    } catch {
      /* changed concurrently — next run re-evaluates */
    }
  }
  if (done) logger.info(`completeBookings marked ${done}`);
});
