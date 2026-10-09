'use client';
import Link from 'next/link';
import { formatDate, slotRemaining, slotState, type FestivalDay } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { Badge } from './ui';
import { IconChevronRight } from './icons';

export function useDayAvailability(dayId: string) {
  const { slotsForDay, settings } = useTemple();
  const slots = slotsForDay(dayId);
  const remaining = slots.reduce((s, x) => s + slotRemaining(x), 0);
  const capacity = slots.reduce((s, x) => s + x.capacity, 0);
  const state = !slots.length ? 'closed'
    : remaining === 0 ? 'full'
    : slotState({ capacity, bookedCount: capacity - remaining, active: true }, settings?.limitedThresholdPct);
  return { slots, remaining, state };
}

export function DayAvailability({ dayId }: { dayId: string }) {
  const { t } = usePrefs();
  const { remaining, state } = useDayAvailability(dayId);
  const c = { available: 'green', limited: 'amber', full: 'red', closed: 'gray' } as const;
  return (
    <Badge color={c[state as keyof typeof c]}>
      {state === 'full' || state === 'closed' ? t(state) : `${t('remaining')}: ${remaining}`}
    </Badge>
  );
}

export function DayNumber({ n, size = 'md' }: { n: number; size?: 'md' | 'lg' }) {
  const s = size === 'lg' ? 'h-16 w-16 text-2xl' : 'h-12 w-12 text-xl';
  return (
    <div className={`grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-light to-gold font-display font-bold text-maroon-900 shadow-inner ring-4 ring-gold-pale ${s}`}>
      {n}
    </div>
  );
}

export function DayCard({ day, past }: { day: FestivalDay; past?: boolean }) {
  const { tr, lang, t } = usePrefs();
  return (
    <Link
      href={`/book?day=${day.id}`}
      className={`card group flex h-full items-start gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lift md:p-5 ${past ? 'opacity-55' : ''}`}
    >
      <DayNumber n={day.dayNumber} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 text-[0.9rem] text-ink-soft">
          <span className="font-semibold text-crimson">{tr(day.dayName)}</span>
          <span>· {formatDate(day.date, lang, { weekday: true, year: false })}</span>
        </div>
        <div className="mt-0.5 font-display text-[1.08rem] font-bold leading-snug text-maroon">{tr(day.title)}</div>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <DayAvailability dayId={day.id} />
          <span className="inline-flex items-center text-[0.92rem] font-semibold text-crimson group-hover:underline">
            {t('bookUbayam')} <IconChevronRight size={18} />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function todayYmd(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}
