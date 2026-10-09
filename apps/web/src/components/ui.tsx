'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { paymentStage, slotRemaining, slotState, type Booking, type TimeSlot } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { IconAlert } from './icons';

const tone = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  red: 'bg-red-50 text-red-800 ring-red-600/25',
  gray: 'bg-stone-100 text-stone-700 ring-stone-500/25',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/25',
};

export function Badge({ color, children, dot = true }: { color: keyof typeof tone; children: ReactNode; dot?: boolean }) {
  const dotColor = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', gray: 'bg-stone-400', blue: 'bg-sky-500' }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.85rem] font-semibold ring-1 ${tone[color]}`}>
      {dot && <span className={`h-2 w-2 rounded-full ${dotColor}`} />}
      {children}
    </span>
  );
}

export function SlotBadge({ slot, pct }: { slot: TimeSlot; pct?: number }) {
  const { t } = usePrefs();
  const s = slotState(slot, pct);
  const map = { available: ['green', 'available'], limited: ['amber', 'limited'], full: ['red', 'full'], closed: ['gray', 'closed'] } as const;
  const [c, k] = map[s];
  return <Badge color={c}>{t(k)}</Badge>;
}

export function SlotCounts({ slot }: { slot: TimeSlot }) {
  const { t } = usePrefs();
  return (
    <div className="grid grid-cols-3 gap-1 text-center text-[0.8rem] text-ink-soft">
      <div><div className="text-[1.05rem] font-bold text-ink">{slot.capacity}</div>{t('capacity')}</div>
      <div><div className="text-[1.05rem] font-bold text-ink">{slot.bookedCount}</div>{t('booked')}</div>
      <div><div className="text-[1.05rem] font-bold text-crimson">{slotRemaining(slot)}</div>{t('remaining')}</div>
    </div>
  );
}

export function PaymentBadge({ b }: { b: Booking }) {
  const { t } = usePrefs();
  const st = paymentStage(b);
  const c = { awaiting_payment: 'amber', verifying: 'blue', paid: 'green', rejected: 'red' } as const;
  return <Badge color={c[st]}>{t(`st_${st}`)}</Badge>;
}

export function BookingBadge({ b }: { b: Booking }) {
  const { t } = usePrefs();
  const c = { pending: 'amber', confirmed: 'green', cancelled: 'gray', completed: 'blue' } as const;
  return <Badge color={c[b.bookingStatus]}>{t(`st_${b.bookingStatus}`)}</Badge>;
}

export function ErrorBox({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
      <IconAlert className="mt-0.5 shrink-0" />
      <div className="font-medium">{children}</div>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-r-transparent ${className}`} aria-hidden />;
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

/** QR rendered locally (no network) — qrcode is loaded lazily to keep first paint small. */
export function QrImage({ value, size = 220, className = '' }: { value: string; size?: number; className?: string }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    import('qrcode').then((QR) =>
      QR.toDataURL(value, { width: size * 2, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#2B1A14', light: '#FFFFFF' } }),
    ).then((url) => alive && setSrc(url));
    return () => { alive = false; };
  }, [value, size]);
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt="QR" width={size} height={size} className={className} style={{ width: size, height: size }} />
    : <Skeleton className={className} />;
}

export function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dashed border-gold/25 py-2.5 last:border-0">
      <dt className="text-ink-soft">{label}</dt>
      <dd className="text-right font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function useCopy(): [string | null, (text: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  return [copied, (text) => {
    navigator.clipboard?.writeText(text).then(() => {
      setCopied(text);
      setTimeout(() => setCopied(null), 1800);
    });
  }];
}
