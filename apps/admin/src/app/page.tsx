'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { collection, getAggregateFromServer, getCountFromServer, getDocs, limit, orderBy, query, sum, Timestamp, where, type QueryConstraint } from 'firebase/firestore';
import { formatINR, slotRemaining, slotState, type Booking } from '@temple/shared';
import { getDb } from '@/lib/firebase';
import { useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Badge, Btn, Card, Empty, Skeleton } from '@/components/ui';
import { BookingList, BookingModal, fmtDate, fmtTime } from '@/components/booking';
import { IconRefresh } from '@/components/icons';

type Stats = Record<'total' | 'today' | 'confirmed' | 'pending' | 'verify' | 'cancelled' | 'families' | 'groups' | 'revenue', number>;

function istStartOfToday(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  return new Date(`${ymd}T00:00:00+05:30`);
}

export default function Dashboard() {
  return <NeedFestival><DashboardInner /></NeedFestival>;
}

function DashboardInner() {
  const { festivalId, festival, days, slots, settings } = useConfig();
  const [stats, setStats] = useState<Stats | null>(null);
  const [verify, setVerify] = useState<Booking[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const col = collection(getDb(), 'bookings');
    const f = where('festivalId', '==', festivalId);
    const active = where('bookingStatus', 'in', ['pending', 'confirmed', 'completed']);
    const count = (...c: QueryConstraint[]) => getCountFromServer(query(col, f, ...c)).then((s) => s.data().count);
    try {
      const [total, today, confirmed, pending, verifyCount, cancelled, families, groups, revenue, list] = await Promise.all([
        count(),
        count(where('createdAt', '>=', Timestamp.fromDate(istStartOfToday()))),
        count(where('bookingStatus', 'in', ['confirmed', 'completed'])),
        count(where('bookingStatus', '==', 'pending')),
        count(where('bookingStatus', '==', 'pending'), where('paymentStatus', '==', 'pending'), where('paymentSubmitted', '==', true)),
        count(where('bookingStatus', '==', 'cancelled')),
        count(where('bookingType', '==', 'family'), active),
        count(where('bookingType', '==', 'group'), active),
        getAggregateFromServer(query(col, f, where('paymentStatus', '==', 'paid')), { s: sum('amount') }).then((r) => r.data().s ?? 0),
        getDocs(query(col, f, where('paymentStatus', '==', 'pending'), where('bookingStatus', '==', 'pending'), orderBy('createdAt', 'desc'), limit(40))),
      ]);
      setStats({ total, today, confirmed, pending, verify: verifyCount, cancelled, families, groups, revenue });
      setVerify(list.docs.map((d) => d.data() as Booking).filter((b) => b.paymentSubmitted).slice(0, 8));
    } finally {
      setLoading(false);
    }
  }, [festivalId]);

  useEffect(() => {
    refresh();
    const i = setInterval(refresh, 60_000);
    return () => clearInterval(i);
  }, [refresh]);

  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const focusDay = days.find((d) => d.date >= today) ?? days[days.length - 1];
  const daySlots = focusDay ? slots.filter((s) => s.dayId === focusDay.id) : [];

  const cards: { k: keyof Stats; label: string; tone: string; href?: string; money?: boolean }[] = [
    { k: 'total', label: 'Total Bookings', tone: 'from-maroon to-crimson-600 text-cream', href: '/bookings' },
    { k: 'today', label: "Today's Bookings", tone: 'from-white to-saffron-pale' },
    { k: 'confirmed', label: 'Confirmed', tone: 'from-white to-emerald-50', href: '/bookings?bookingStatus=confirmed' },
    { k: 'pending', label: 'Pending Payment', tone: 'from-white to-amber-50', href: '/payments' },
    { k: 'cancelled', label: 'Cancelled', tone: 'from-white to-stone-100', href: '/bookings?bookingStatus=cancelled' },
    { k: 'families', label: 'Families', tone: 'from-white to-cream-deep', href: '/families' },
    { k: 'groups', label: 'Groups', tone: 'from-white to-cream-deep', href: '/groups' },
    { k: 'revenue', label: 'Revenue (paid)', tone: 'from-gold-light to-gold text-maroon-900', money: true, href: '/reports' },
  ];

  return (
    <>
      <PageHead title="Dashboard" sub={festival ? `${festival.name.en} · ${fmtDate(festival.startDate)} – ${fmtDate(festival.endDate)}` : ''}
        actions={<><Btn onClick={refresh} busy={loading}><IconRefresh size={16} /> Refresh</Btn><Link href="/bookings/new"><Btn kind="primary">+ Manual booking</Btn></Link></>} />

      {!settings?.bookingOpen && <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-900">Online booking is currently CLOSED. <Link className="underline" href="/settings">Open it in Settings</Link>.</div>}

      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        {cards.map((c) => {
          const body = (
            <div className={`h-full rounded-2xl border border-gold/20 bg-gradient-to-br p-4 shadow-card transition hover:shadow-lift md:p-5 ${c.tone}`}>
              <div className="text-[0.8rem] font-semibold uppercase tracking-wide opacity-75">{c.label}</div>
              {stats ? (
                <div className="mt-1.5 font-display text-[1.9rem] font-bold leading-none">{c.money ? formatINR(stats[c.k]) : stats[c.k].toLocaleString('en-IN')}</div>
              ) : <Skeleton className="mt-2 h-8 w-20" />}
              {c.k === 'pending' && stats && <div className="mt-2 text-sm font-semibold text-sky-800">{stats.verify} awaiting verification</div>}
            </div>
          );
          return c.href ? <Link key={c.k} href={c.href}>{body}</Link> : <div key={c.k}>{body}</div>;
        })}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title="Payments to verify" actions={<Link href="/payments" className="text-sm font-semibold text-crimson">All payments →</Link>}>
          {verify.length ? <BookingList items={verify} onOpen={setOpen} /> : <Empty>No payments waiting. 🙏</Empty>}
        </Card>
        <Card title={focusDay ? `Slots · Day ${focusDay.dayNumber} (${fmtDate(focusDay.date)})` : 'Slots'} actions={<Link href="/slots" className="text-sm font-semibold text-crimson">Manage →</Link>}>
          <div className="space-y-4 p-5">
            {daySlots.length ? daySlots.map((s) => {
              const st = slotState(s, settings?.limitedThresholdPct);
              const pct = Math.min(100, Math.round((s.bookedCount / Math.max(1, s.capacity)) * 100));
              return (
                <div key={s.id}>
                  <div className="flex items-center justify-between text-[0.92rem]">
                    <span className="font-semibold">{fmtTime(s.time)} <span className="font-normal text-ink-mute">{s.label?.en}</span></span>
                    <span className="flex items-center gap-2">{s.bookedCount}/{s.capacity} · {slotRemaining(s)} left
                      <Badge tone={st === 'available' ? 'green' : st === 'limited' ? 'amber' : st === 'full' ? 'red' : 'gray'}>{st}</Badge></span>
                  </div>
                  <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-gold-pale">
                    <div className={`h-full rounded-full ${st === 'full' ? 'bg-red-500' : st === 'limited' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            }) : <Empty>No slots configured.</Empty>}
          </div>
        </Card>
      </div>
      <BookingModal bookingId={open} onClose={() => { setOpen(null); refresh(); }} />
    </>
  );
}
