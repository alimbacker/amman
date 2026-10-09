import type { Transaction, DocumentSnapshot } from 'firebase-admin/firestore';
import { db, fail, FieldValue, Timestamp, getSettings, auditEntry } from './core';
import {
  RuleError,
  capacityUnits,
  checkCapacity,
  formatBookingId,
  lockId,
  zonedToUtc,
  type NormalizedBooking,
} from './logic';
import type { Booking, Festival, FestivalDay, PaymentMode, TimeSlot, UbayamType } from '@temple/shared';

const MAX_UNPAID_HOLDS_PER_DEVICE = 3;
const MAX_UNPAID_HOLDS_PER_MOBILE = 2;
/** Unpaid online holds may occupy at most this share of a slot, so a script cannot lock a whole slot. */
const MAX_UNPAID_SHARE_OF_SLOT = 0.5;

/** Converts pure-rule errors into callable errors. Wrap every callable body with it. */
export async function guard<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof RuleError) fail(e.code, e.message);
    throw e;
  }
}

export interface CreateContext {
  uid: string | null; // customer uid (null for admin-created)
  source: 'online' | 'admin';
  paymentMode: PaymentMode; // 'upi' for online; admin may choose cash/upi/later
  transactionId?: string | null; // admin manual booking with a known UTR
  admin?: { uid: string; email: string | null };
}

/**
 * Creates a booking atomically:
 *   validates festival/day/slot/ubayam, enforces capacity and one-booking-per-mobile-per-slot,
 *   allocates a sequential booking ID, increments the slot counter and writes the
 *   normalised family / group / member records — all in ONE transaction, so two devotees
 *   racing for the last place can never both get it.
 */
export async function createBookingCore(input: NormalizedBooking, ctx: CreateContext) {
  const settings = await getSettings();
  if (ctx.source === 'online' && !settings.bookingOpen) throw new RuleError('BOOKING_CLOSED');

  return db.runTransaction(async (tx) => {
    // ---------- reads (all before any write) ----------
    const slotRef = db.doc(`timeSlots/${input.slotId}`);
    const ubRef = db.doc(`ubayamTypes/${input.ubayamTypeId}`);
    const [slotSnap, ubSnap] = await tx.getAll(slotRef, ubRef);
    if (!slotSnap.exists || !ubSnap.exists) throw new RuleError('NOT_FOUND', 'slot or ubayam not found');
    const slot = slotSnap.data() as TimeSlot;
    const ub = ubSnap.data() as UbayamType;

    const dayRef = db.doc(`festivalDays/${slot.dayId}`);
    const festRef = db.doc(`festivals/${slot.festivalId}`);
    const lockRef = db.doc(`bookingLocks/${lockId(input.slotId, input.mobileNumber)}`);
    // Counter is keyed by the visible ID prefix (e.g. "KA26"), so two festivals in one year never reuse an ID.
    const idPrefix = formatBookingId(settings.bookingPrefix, slot.date, 0).split('-')[0]; // e.g. KA26
    const counterRef = db.doc(`counters/${idPrefix}`);
    const txnRef = ctx.transactionId ? db.doc(`paymentTxnIds/${ctx.transactionId}`) : null;
    const refs = [dayRef, festRef, lockRef, counterRef, ...(txnRef ? [txnRef] : [])];
    const [daySnap, festSnap, lockSnap, counterSnap, txnSnap] = await tx.getAll(...refs);
    if (!daySnap.exists || !festSnap.exists) throw new RuleError('NOT_FOUND', 'day or festival not found');
    const day = daySnap.data() as FestivalDay;
    const fest = festSnap.data() as Festival;

    const slotStart = zonedToUtc(slot.date, slot.time, settings.timezone || 'Asia/Kolkata');
    if (ctx.source === 'online') {
      if (!fest.active || !day.active || !slot.active) throw new RuleError('SLOT_CLOSED');
      if (slotStart.getTime() <= Date.now()) throw new RuleError('SLOT_CLOSED', 'slot time has passed');
    }
    if (!ub.active || ub.festivalId !== slot.festivalId) throw new RuleError('SLOT_CLOSED', 'ubayam not available');
    if (ub.dayIds?.length && !ub.dayIds.includes(slot.dayId)) throw new RuleError('SLOT_CLOSED', 'ubayam not offered on this day');
    if (input.bookingType === 'family' && ub.allowFamily === false) throw new RuleError('INVALID_INPUT', 'family booking not allowed for this ubayam');
    if (input.bookingType === 'group' && ub.allowGroup === false) throw new RuleError('INVALID_INPUT', 'group booking not allowed for this ubayam');

    if (lockSnap.exists) throw new RuleError('DUPLICATE_BOOKING');
    if (txnSnap?.exists) throw new RuleError('DUPLICATE_TXN');

    if (ctx.source === 'online' && ctx.uid) {
      const unpaid = db.collection('bookings').where('bookingStatus', '==', 'pending').where('paymentSubmitted', '==', false);
      const slotCap = Math.max(3, Math.floor(slot.capacity * MAX_UNPAID_SHARE_OF_SLOT));
      const [byDevice, byMobile, bySlot] = await Promise.all([
        tx.get(unpaid.where('userId', '==', ctx.uid).limit(MAX_UNPAID_HOLDS_PER_DEVICE)),
        tx.get(unpaid.where('mobileNumber', '==', input.mobileNumber).limit(MAX_UNPAID_HOLDS_PER_MOBILE)),
        tx.get(unpaid.where('slotId', '==', input.slotId).limit(slotCap)),
      ]);
      if (byDevice.size >= MAX_UNPAID_HOLDS_PER_DEVICE || byMobile.size >= MAX_UNPAID_HOLDS_PER_MOBILE) throw new RuleError('TOO_MANY_HOLDS');
      // Many unpaid holds on one slot: ask the devotee to retry shortly (holds expire automatically).
      if (bySlot.size >= slotCap) throw new RuleError('SLOT_FULL', 'slot temporarily held by unpaid bookings');
    }

    const units = capacityUnits(settings.capacityMode, input.memberCount);
    checkCapacity(slot, units);

    const seq = ((counterSnap.data()?.seq as number) ?? 0) + 1;
    const bookingId = formatBookingId(settings.bookingPrefix, slot.date, seq);
    const bookingRef = db.doc(`bookings/${bookingId}`);

    // ---------- derive state ----------
    const now = FieldValue.serverTimestamp();
    const settledByAdmin = ctx.source === 'admin' && (ctx.paymentMode === 'cash' || (ctx.paymentMode === 'upi' && !!ctx.transactionId));
    const holdExpiresAt =
      ctx.source === 'online' ? Timestamp.fromMillis(Date.now() + (settings.holdMinutes || 30) * 60_000) : null;
    const amount = Number(ub.price) || 0;

    const booking: Omit<Booking, 'createdAt' | 'updatedAt' | 'confirmedAt' | 'slotStartAt' | 'holdExpiresAt'> & Record<string, unknown> = {
      bookingId,
      userId: ctx.uid ?? '',
      viewerUids: ctx.uid ? [ctx.uid] : [],
      festivalId: slot.festivalId,
      dayId: slot.dayId,
      dayNumber: day.dayNumber,
      date: slot.date,
      slotId: input.slotId,
      time: slot.time,
      slotStartAt: Timestamp.fromDate(slotStart),
      bookingType: input.bookingType,
      ubayamTypeId: input.ubayamTypeId,
      ubayamType: ub.name,
      familyName: input.familyName,
      memberNames: input.memberNames,
      groupId: input.bookingType === 'group' ? bookingId : null,
      groupName: input.groupName,
      families: input.families,
      contactName: input.contactName,
      mobileNumber: input.mobileNumber,
      memberCount: input.memberCount,
      note: input.note,
      amount,
      units,
      paymentStatus: settledByAdmin ? 'paid' : 'pending',
      bookingStatus: settledByAdmin ? 'confirmed' : 'pending',
      paymentSubmitted: settledByAdmin,
      paymentMode: ctx.paymentMode,
      transactionId: settledByAdmin ? ctx.transactionId ?? null : null,
      amountPaid: settledByAdmin ? amount : null,
      rejectionReason: null,
      cancelReason: null,
      holdExpiresAt,
      source: ctx.source,
      createdBy: ctx.admin?.uid ?? ctx.uid,
      createdAt: now,
      updatedAt: now,
      confirmedAt: settledByAdmin ? now : null,
      paymentId: null,
      paymentAttempts: 0,
    };

    // ---------- writes ----------
    if (settledByAdmin) {
      const payRef = db.collection('payments').doc();
      booking.paymentId = payRef.id;
      tx.set(payRef, {
        bookingId,
        transactionId: ctx.transactionId ?? `CASH-${bookingId}`,
        amountEntered: amount,
        expectedAmount: amount,
        mobileNumber: input.mobileNumber,
        contactName: input.contactName,
        festivalId: slot.festivalId,
        status: 'paid',
        mode: ctx.paymentMode,
        submittedAt: now,
        verifiedAt: now,
        verifiedBy: ctx.admin?.email ?? ctx.admin?.uid ?? null,
        reason: null,
      });
      if (txnRef) tx.set(txnRef, { bookingId, createdAt: now });
    }

    tx.create(bookingRef, booking); // never overwrite an existing booking
    tx.set(lockRef, { bookingId, createdAt: now });
    tx.update(slotRef, { bookedCount: FieldValue.increment(units), updatedAt: now });
    tx.set(counterRef, { seq }, { merge: true });

    const linked = { bookingId, festivalId: slot.festivalId, dayId: slot.dayId, slotId: input.slotId, date: slot.date, time: slot.time,
      bookingStatus: booking.bookingStatus, paymentStatus: booking.paymentStatus, contactName: input.contactName, mobileNumber: input.mobileNumber, createdAt: now };
    if (input.bookingType === 'family') {
      const famId = `${bookingId}_F1`;
      tx.set(db.doc(`families/${famId}`), { ...linked, groupId: null, familyName: input.familyName, memberCount: input.memberCount });
      input.memberNames.forEach((name, j) =>
        tx.set(db.doc(`familyMembers/${famId}_M${j + 1}`), { bookingId, familyId: famId, name, createdAt: now }),
      );
    } else {
      tx.set(db.doc(`groups/${bookingId}`), { ...linked, groupName: input.groupName, familyCount: input.families.length, totalMembers: input.memberCount });
      input.families.forEach((f, i) =>
        tx.set(db.doc(`families/${bookingId}_F${i + 1}`), { ...linked, groupId: bookingId, familyName: f.familyName, memberCount: f.memberCount }),
      );
    }

    if (ctx.uid) {
      tx.set(db.doc(`users/${ctx.uid}`), {
        mobiles: FieldValue.arrayUnion(input.mobileNumber),
        name: input.contactName,
        lastBookingAt: now,
      }, { merge: true });
    }
    if (ctx.admin) {
      tx.set(db.collection('auditLogs').doc(), auditEntry('booking.create_manual', `bookings/${bookingId}`,
        ctx.admin, { paymentMode: ctx.paymentMode, amount, slotId: input.slotId }));
    }

    return { bookingId, amount, holdExpiresAt: holdExpiresAt ? holdExpiresAt.toDate().toISOString() : null };
  });
}

/** Must be called (inside the transaction, before any write) to learn whether the booking owns its UTR reservation. */
export async function ownsTxnLock(tx: Transaction, b: Pick<Booking, 'bookingId' | 'transactionId'>): Promise<boolean> {
  if (!b.transactionId) return false;
  const lock = await tx.get(db.doc(`paymentTxnIds/${b.transactionId}`));
  return lock.exists && lock.get('bookingId') === b.bookingId;
}

/**
 * Cancels inside a caller's transaction and gives the place back to the slot.
 * Caller must have read `snap` in the same transaction.
 */
export function cancelInTx(tx: Transaction, snap: DocumentSnapshot, reason: string, extra: Record<string, unknown> = {}, txnLockOwned = false) {
  const b = snap.data() as Booking;
  tx.update(snap.ref, {
    bookingStatus: 'cancelled',
    cancelReason: reason,
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    holdExpiresAt: null,
    refundDue: b.paymentStatus === 'paid',
    ...extra,
  });
  tx.update(db.doc(`timeSlots/${b.slotId}`), { bookedCount: FieldValue.increment(-(b.units || 1)) });
  tx.delete(db.doc(`bookingLocks/${lockId(b.slotId, b.mobileNumber)}`));
  // An unpaid booking's UTR is released so a mistyped number cannot block its real owner.
  // (Deleting a lock that belongs to another booking is impossible: lock IDs are UTRs and a UTR maps to one booking.)
  if (b.transactionId && b.paymentStatus !== 'paid' && txnLockOwned) tx.delete(db.doc(`paymentTxnIds/${b.transactionId}`));
}
