/**
 * Shared data model for the Navaratri Ubayam booking system.
 * Used by the customer website, the admin dashboard and (copied at build time) Cloud Functions.
 * The Flutter app mirrors these shapes in lib/models.dart — keep them in sync.
 */

export type Lang = 'ta' | 'en';
export type BookingType = 'family' | 'group';
export type PaymentStatus = 'pending' | 'paid' | 'rejected';
export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed';
export type CapacityMode = 'bookings' | 'members';
export type PaymentMode = 'upi' | 'cash' | 'later';

export interface Bilingual {
  ta: string;
  en: string;
}

/** settings/public — readable by everyone, writable by admins only. */
export interface TempleSettings {
  templeName: Bilingual;
  location: Bilingual;
  address: Bilingual;
  about: Bilingual;
  phone: string;
  whatsapp: string; // digits incl. country code, e.g. 919876543210
  logoUrl: string;
  heroImageUrl: string;
  upiId: string;
  upiPayeeName: string; // account / temple name shown on the payment screen
  upiQrUrl: string; // uploaded QR image; if empty a QR is generated from upiId
  upiInstructions: Bilingual;
  currentFestivalId: string;
  bookingOpen: boolean;
  bookingPrefix: string; // e.g. "KA" → KA26-0001
  holdMinutes: number; // how long an unpaid booking holds a slot
  capacityMode: CapacityMode; // a slot's capacity counts bookings or members
  maxMembersPerBooking: number;
  limitedThresholdPct: number; // remaining ≤ this % of capacity → "Limited"
  faq: { q: Bilingual; a: Bilingual }[];
  timezone: string; // IANA, e.g. Asia/Kolkata
}

export interface Festival {
  id: string;
  name: Bilingual;
  description: Bilingual;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  active: boolean;
}

export interface FestivalDay {
  id: string;
  festivalId: string;
  dayNumber: number;
  date: string; // YYYY-MM-DD
  dayName: Bilingual; // "முதல் நாள்" / "Day 1"
  title: Bilingual; // ubayam / alankaram name of the day
  description: Bilingual;
  active: boolean;
}

export interface UbayamType {
  id: string;
  festivalId: string;
  name: Bilingual;
  description: Bilingual;
  price: number; // INR per booking
  dayIds: string[]; // empty = available on every day
  allowFamily: boolean;
  allowGroup: boolean;
  active: boolean;
  sortOrder: number;
}

export interface TimeSlot {
  id: string;
  festivalId: string;
  dayId: string;
  date: string; // denormalised from the day
  time: string; // HH:mm, 24h, temple local time
  label: Bilingual; // optional, e.g. "காலை பூஜை"
  capacity: number;
  bookedCount: number; // maintained ONLY by Cloud Functions
  active: boolean;
}

export interface GroupFamily {
  familyName: string;
  memberCount: number;
}

/** Firestore Timestamp-like (works for both SDK Timestamps and plain JSON from callables). */
export interface TS {
  seconds: number;
  nanoseconds?: number;
  toDate?: () => Date;
}

export interface Booking {
  bookingId: string;
  userId: string;
  viewerUids: string[];
  festivalId: string;
  dayId: string;
  dayNumber: number;
  date: string;
  slotId: string;
  time: string;
  slotStartAt: TS;
  bookingType: BookingType;
  ubayamTypeId: string;
  ubayamType: Bilingual;
  familyName: string | null;
  memberNames: string[];
  groupId: string | null;
  groupName: string | null;
  families: GroupFamily[];
  contactName: string;
  mobileNumber: string;
  memberCount: number;
  note: string;
  amount: number;
  units: number; // capacity units this booking holds
  paymentStatus: PaymentStatus;
  bookingStatus: BookingStatus;
  paymentSubmitted: boolean;
  paymentMode: PaymentMode;
  transactionId: string | null;
  amountPaid: number | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  holdExpiresAt: TS | null;
  source: 'online' | 'admin';
  createdAt: TS;
  updatedAt: TS;
  confirmedAt: TS | null;
  paymentSubmittedAt?: TS | null;
  paymentId?: string | null;
  verifiedBy?: string | null;
  refundDue?: boolean;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  transactionId: string;
  amountEntered: number;
  expectedAmount: number;
  mobileNumber: string;
  contactName: string;
  status: PaymentStatus;
  mode: PaymentMode;
  submittedAt: TS;
  verifiedAt: TS | null;
  verifiedBy: string | null;
  reason: string | null;
}

export interface NotificationRecord {
  id: string;
  audience: 'all' | 'user' | 'admin';
  type: 'announcement' | 'booking_update' | 'payment_submitted' | 'new_booking';
  title: Bilingual;
  body: Bilingual;
  bookingId: string | null;
  userIds: string[];
  createdAt: TS;
  createdBy: string | null;
}

export interface AuditLog {
  id: string;
  action: string;
  target: string;
  actorUid: string | null;
  actorEmail: string | null;
  details: Record<string, unknown>;
  createdAt: TS;
}

/* ------------------------------------------------------------------ */
/* Callable contract (Cloud Functions, region below)                  */
/* ------------------------------------------------------------------ */

export const FUNCTIONS_REGION = 'asia-south1';

export interface CreateBookingInput {
  slotId: string;
  ubayamTypeId: string;
  bookingType: BookingType;
  contactName: string;
  mobileNumber: string;
  familyName?: string;
  memberCount?: number;
  memberNames?: string[];
  groupName?: string;
  families?: GroupFamily[];
  note?: string;
}
export interface CreateBookingResult {
  bookingId: string;
  amount: number;
  holdExpiresAt: string | null; // ISO
}

export interface SubmitPaymentInput {
  bookingId: string;
  mobileNumber: string;
  transactionId: string;
  amount: number;
}

export interface LookupBookingInput {
  bookingId: string;
  mobileNumber: string;
}

export interface AdminCreateBookingInput extends CreateBookingInput {
  paymentMode: PaymentMode;
  transactionId?: string;
}

export interface AdminVerifyPaymentInput {
  bookingId: string;
  action: 'approve' | 'reject' | 'cash';
  reason?: string;
}

export interface AdminCancelBookingInput {
  bookingId: string;
  reason: string;
}

export interface AdminSendNotificationInput {
  title: Bilingual;
  body: Bilingual;
  target: 'all' | 'booking';
  bookingId?: string;
}

/** Error codes returned in HttpsError details.code — clients translate them. */
export type BookingErrorCode =
  | 'SLOT_FULL'
  | 'SLOT_CLOSED'
  | 'BOOKING_CLOSED'
  | 'DUPLICATE_BOOKING'
  | 'DUPLICATE_TXN'
  | 'HOLD_EXPIRED'
  | 'NOT_FOUND'
  | 'INVALID_STATE'
  | 'TOO_MANY_HOLDS'
  | 'RATE_LIMITED'
  | 'INVALID_INPUT'
  | 'NOT_ALLOWED';
