'use client';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { PageTitle } from '@/components/shell';
import { DayCard, todayYmd } from '@/components/days';
import { Skeleton } from '@/components/ui';

export default function DaysPage() {
  const { t, tr } = usePrefs();
  const { festival, activeDays, ready } = useTemple();
  const today = todayYmd();
  return (
    <>
      <PageTitle title={t('navaratriDays')} sub={festival ? tr(festival.name) : undefined} />
      <div className="mx-auto max-w-6xl px-4">
        {!ready && !activeDays.length ? (
          <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : activeDays.length ? (
          <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {activeDays.map((d) => (
              <div key={d.id} className="flex flex-col">
                <DayCard day={d} past={d.date < today} />
                {tr(d.description) && <p className="px-2 pt-2 text-[0.95rem] text-ink-soft">{tr(d.description)}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-ink-soft">{t('noFestival')}</div>
        )}
      </div>
    </>
  );
}
