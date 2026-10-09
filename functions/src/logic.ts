/**
 * Pure booking rules — no Firestore access, so they are unit-tested directly (test/logic.test.ts).
 */
import { z } from 'zod';
import type { Booking, BookingErrorCode, CapacityMode, GroupFamily } from './shared/model';
import { normalizeMobile, normalizeTxnId } from './shared/utils';

const text = (max: number) => z.string().trim().max(max);

export const createBookingSchema = z.object({
  slotId: z.string().min(1).max(64),
  ubayamTypeId: z.string().min(1).max(64),
  bookingType: z.enum(['family', 'group']),
  contactName: text(80).pipe(z.string().min(2)),
  mobileNumber: z.string().max(20),
  familyName: text(80).optional(),
  memberCount: z.number().int().optional(),
  memberNames: z.array(text(80)).max(100).optional(),
  groupName: text(80).optional(),
  families: z
    .array(z.object({ familyName: text(80), memberCount: z.number().int() }))
    .max(50)
    .optional(),
  note: text(500).optional(),
});
export type CreateBookingRaw = z.infer<typeof createBookingSchema>;

export const submitPaymentSchema = z.object({
  bookingId: z.string().min(3).max(40),
  mobileNumber: z.string().max(20),
  transactionId: z.string().max(60),
  amount: z.number().nonnegative().max(10_000_000),
});

export const lookupSchema = z.object({
  bookingId: z.string().min(3).max(40),
  mobileNumber: z.string().max(20),
});

export class RuleError extends Error {
  constructor(public code: BookingErrorCode, message?: string) {
    super(message ?? code);
  }
}

export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) {
    const i = r.error.issues[0];
    throw new RuleError('INVALID_INPUT', `${i.path.join('.') || 'input'}: ${i.message}`);
  }
  return r.data;
}

export interface NormalizedBooking {
  slotId: string;
  ubayamTypeId: string;
  bookingType: 'family' | 'group';
  contactName: string;
  mobileNumber: string;
  familyName: string | null;
  memberNames: string[];
  groupName: string | null;
  families: GroupFamily[];
  memberCount: number;
  note: string;
}

/** Applies the business rules on top of the schema: required fields per type, member limits, mobile format. */
export function normalizeBooking(raw: CreateBookingRaw, maxMembersPerBooking: number): NormalizedBooking {
  const mobile = normalizeMobile(raw.mobileNumber);
  if (!mobile) throw new RuleError('INVALID_INPUT', 'mobileNumber: invalid');
  const base = {
    slotId: raw.slotId,
    ubayamTypeId: raw.ubayamTypeId,
    bookingType: raw.bookingType,
    contactName: raw.contactName,
    mobileNumber: mobile,
    note: raw.note ?? '',
  };

  if (raw.bookingType === 'family') {
    const familyName = (raw.familyName ?? '').trim();
    if (familyName.length < 2) throw new RuleError('INVALID_INPUT', 'familyName: required');
    const memberCount = raw.memberCount ?? 0;
    if (memberCount < 1 || memberCount > maxMembersPerBooking) {
      throw new RuleError('INVALID_INPUT', `memberCount: must be 1-${maxMembersPerBooking}`);
    }
    const memberNames = (raw.memberNames ?? []).map((n) => n.trim()).filter(Boolean).slice(0, memberCount);
    return { ...base, familyName, memberNames, groupName: null, families: [], memberCount };
  }

  const groupName = (raw.groupName ?? '').trim();
  if (groupName.length < 2) throw new RuleError('INVALID_INPUT', 'groupName: required');
  const families = (raw.families ?? [])
    .map((f) => ({ familyName: f.familyName.trim(), memberCount: f.memberCount }))
    .filter((f) => f.familyName.length > 0);
  if (families.length < 2) throw new RuleError('INVALID_INPUT', 'families: a group needs at least 2 families');
  for (const f of families) {
    if (f.memberCount < 1 || f.memberCount > maxMembersPerBooking) {
      throw new RuleError('INVALID_INPUT', `families.memberCount: must be 1-${maxMembersPerBooking}`);
    }
  }
  const memberCount = families.reduce((s, f) => s + f.memberCount, 0);
  if (memberCount > 1000) throw new RuleError('INVALID_INPUT', 'families: too many members');
  return { ...base, familyName: null, memberNames: [], groupName, families, memberCount };
}

export function capacityUnits(mode: CapacityMode, memberCount: number): number {
  return mode === 'members' ? memberCount : 1;
}

export function checkCapacity(slot: { capacity: number; bookedCount: number }, units: number): void {
  if ((slot.bookedCount ?? 0) + units > slot.capacity) throw new RuleError('SLOT_FULL');
}

/** KA + 26 + seq → "KA26-0042" */
export function formatBookingId(prefix: string, festivalStartDate: string, seq: number): string {
  const yy = (festivalStartDate || '').slice(2, 4) || String(new Date().getFullYear()).slice(2);
  const p = (prefix || 'BK').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6) || 'BK';
  return `${p}${yy}-${String(seq).padStart(4, '0')}`;
}

export function lockId(slotId: string, mobile: string): string {
  return `${slotId}_${mobile}`;
}

function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** Temple-local "2026-10-11" + "18:30" → the UTC instant. */
export function zonedToUtc(date: string, time: string, timeZone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off1 = tzOffsetMs(new Date(guess), timeZone);
  let utc = guess - off1;
  const off2 = tzOffsetMs(new Date(utc), timeZone);
  if (off2 !== off1) utc = guess - off2;
  return new Date(utc);
}

type B = Pick<Booking, 'bookingStatus' | 'paymentStatus' | 'paymentSubmitted'> & { holdExpiresMs: number | null };

/** May the customer submit (or resubmit) a transaction ID now? */
export function paymentSubmitBlocker(b: B, nowMs: number): BookingErrorCode | null {
  if (b.bookingStatus !== 'pending') return 'INVALID_STATE';
  if (b.paymentStatus === 'paid') return 'INVALID_STATE';
  if (b.paymentSubmitted && b.paymentStatus === 'pending') return 'INVALID_STATE'; // already awaiting verification
  if (b.holdExpiresMs !== null && b.holdExpiresMs <= nowMs) return 'HOLD_EXPIRED';
  return null;
}

/**
 * May an admin act on the payment now?
 *  approve — a submitted UTR is pending, or a previously rejected UTR turned out to be valid
 *  reject  — a submitted UTR is pending
 *  cash    — any unpaid, still-pending booking (paid at the counter)
 */
export function verifyBlocker(
  b: B & { transactionId?: string | null },
  action: 'approve' | 'reject' | 'cash',
): BookingErrorCode | null {
  if (b.bookingStatus !== 'pending' || b.paymentStatus === 'paid') return 'INVALID_STATE';
  const awaitingVerification = b.paymentSubmitted && b.paymentStatus === 'pending';
  if (action === 'cash') return null;
  if (action === 'reject') return awaitingVerification ? null : 'INVALID_STATE';
  return awaitingVerification || (b.paymentStatus === 'rejected' && !!b.transactionId) ? null : 'INVALID_STATE';
}

export function cancelBlocker(b: Pick<Booking, 'bookingStatus'>): BookingErrorCode | null {
  return b.bookingStatus === 'cancelled' || b.bookingStatus === 'completed' ? 'INVALID_STATE' : null;
}

export function normalizeTxnOrThrow(t: string): string {
  const v = normalizeTxnId(t);
  if (!v) throw new RuleError('INVALID_INPUT', 'transactionId: invalid');
  return v;
}
