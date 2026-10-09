import type { Bilingual, Booking, Lang, TS, TimeSlot } from './model';

export type SlotState = 'available' | 'limited' | 'full' | 'closed';

export function slotRemaining(slot: Pick<TimeSlot, 'capacity' | 'bookedCount'>): number {
  return Math.max(0, slot.capacity - slot.bookedCount);
}

export function slotState(
  slot: Pick<TimeSlot, 'capacity' | 'bookedCount' | 'active'>,
  limitedThresholdPct = 25,
): SlotState {
  if (!slot.active) return 'closed';
  const remaining = slotRemaining(slot);
  if (remaining <= 0) return 'full';
  const threshold = Math.max(1, Math.ceil((slot.capacity * limitedThresholdPct) / 100));
  return remaining <= threshold ? 'limited' : 'available';
}

/** Accepts "98765 43210", "+91 98765-43210", "09876543210" → "9876543210". Returns null if invalid. */
export function normalizeMobile(input: string): string | null {
  let d = (input || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? d : null;
}

export function maskMobile(m: string): string {
  return m.length === 10 ? `${m.slice(0, 2)}xxxxxx${m.slice(8)}` : m;
}

/** UPI UTR / reference: 6–35 letters or digits. */
export function normalizeTxnId(input: string): string | null {
  const t = (input || '').replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{6,35}$/.test(t) ? t : null;
}

export function tr(b: Bilingual | undefined | null, lang: Lang): string {
  if (!b) return '';
  return (lang === 'ta' ? b.ta || b.en : b.en || b.ta) || '';
}

export function formatINR(n: number): string {
  return '₹' + Math.round(n || 0).toLocaleString('en-IN');
}

/** "18:30" → "06:30 PM" (en) / "மாலை 6:30" (ta) */
export function formatTime(hhmm: string, lang: Lang): string {
  const [hs, ms] = (hhmm || '0:0').split(':');
  const h = Number(hs);
  const m = String(Number(ms)).padStart(2, '0');
  const h12 = h % 12 === 0 ? 12 : h % 12;
  if (lang === 'ta') {
    const part = h < 12 ? 'காலை' : h < 16 ? 'மதியம்' : h < 19 ? 'மாலை' : 'இரவு';
    return `${part} ${h12}:${m}`;
  }
  return `${String(h12).padStart(2, '0')}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

const TA_MONTHS = ['ஜனவரி', 'பிப்ரவரி', 'மார்ச்', 'ஏப்ரல்', 'மே', 'ஜூன்', 'ஜூலை', 'ஆகஸ்ட்', 'செப்டம்பர்', 'அக்டோபர்', 'நவம்பர்', 'டிசம்பர்'];
const TA_WEEKDAYS = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
const EN_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const EN_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-10-11" → "11 அக்டோபர் 2026" / "Sun, 11 Oct 2026". Pure string math: no timezone drift. */
export function formatDate(ymd: string, lang: Lang, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, mo, d] = (ymd || '').split('-').map(Number);
  if (!y || !mo || !d) return ymd || '';
  const wd = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  const year = opts.year === false ? '' : ` ${y}`;
  if (lang === 'ta') {
    return `${opts.weekday ? TA_WEEKDAYS[wd] + ', ' : ''}${d} ${TA_MONTHS[mo - 1]}${year}`;
  }
  return `${opts.weekday ? EN_WEEKDAYS[wd] + ', ' : ''}${d} ${EN_MONTHS[mo - 1]}${year}`;
}

export function tsToDate(ts: TS | null | undefined | string): Date | null {
  if (!ts) return null;
  if (typeof ts === 'string') return new Date(ts);
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000);
  // callable JSON from admin SDK serialises as {_seconds,_nanoseconds}
  const anyTs = ts as unknown as { _seconds?: number };
  if (typeof anyTs._seconds === 'number') return new Date(anyTs._seconds * 1000);
  return null;
}

export function formatDateTime(ts: TS | null | undefined, lang: Lang): string {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleString(lang === 'ta' ? 'ta-IN' : 'en-IN', {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });
}

/** Payment display stage — finer than paymentStatus, for UI only. */
export type PaymentStage = 'awaiting_payment' | 'verifying' | 'paid' | 'rejected';
export function paymentStage(b: Pick<Booking, 'paymentStatus' | 'paymentSubmitted'>): PaymentStage {
  if (b.paymentStatus === 'paid') return 'paid';
  if (b.paymentStatus === 'rejected') return 'rejected';
  return b.paymentSubmitted ? 'verifying' : 'awaiting_payment';
}

export type BookingBucket = 'upcoming' | 'completed' | 'cancelled';
export function bookingBucket(b: Pick<Booking, 'bookingStatus'>): BookingBucket {
  if (b.bookingStatus === 'cancelled') return 'cancelled';
  if (b.bookingStatus === 'completed') return 'completed';
  return 'upcoming';
}

export function upiLink(p: { upiId: string; payeeName: string; amount: number; note: string }): string {
  // encodeURIComponent (not URLSearchParams): spaces must be %20, not '+', for some UPI apps.
  const q = Object.entries({ pa: p.upiId, pn: p.payeeName, am: p.amount.toFixed(2), cu: 'INR', tn: p.note })
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&');
  return `upi://pay?${q}`;
}

export function whatsappLink(number: string, text: string): string {
  const n = (number || '').replace(/\D/g, '');
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}
