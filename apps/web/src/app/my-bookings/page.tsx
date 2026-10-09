'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { bookingBucket, formatDate, formatINR, formatTime, normalizeMobile, type BookingBucket, type LookupBookingInput } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useMyBookings } from '@/lib/data';
import { AppError, callFn } from '@/lib/firebase';
import { PageTitle } from '@/components/shell';
import { BookingBadge, ErrorBox, PaymentBadge, Skeleton, Spinner } from '@/components/ui';
import { IconChevronRight, IconSearch, IconTicket } from '@/components/icons';

export default function MyBookingsPage() {
  const { t, tr, lang } = usePrefs();
  const { items, loading } = useMyBookings();
  const [tab, setTab] = useState<BookingBucket>('upcoming');
  const list = items.filter((b) => bookingBucket(b) === tab);
  const counts = { upcoming: 0, completed: 0, cancelled: 0 };
  items.forEach((b) => counts[bookingBucket(b)]++);

  return (
    <>
      <PageTitle title={t('myBookings')} />
      <div className="mx-auto grid max-w-6xl gap-6 px-4 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white p-1 shadow-card" role="tablist">
            {(['upcoming', 'completed', 'cancelled'] as const).map((k) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={`min-h-[3rem] rounded-xl px-2 text-[0.95rem] font-semibold transition ${tab === k ? 'bg-crimson text-white shadow' : 'text-ink-soft hover:bg-cream-deep'}`}>
                {t(k)} {counts[k] > 0 && <span className="opacity-80">({counts[k]})</span>}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-3">
            {loading ? [0, 1].map((i) => <Skeleton key={i} className="h-32" />)
              : list.length === 0 ? (
                <div className="card flex flex-col items-center p-10 text-center text-ink-soft">
                  <IconTicket size={40} className="text-gold" />
                  <p className="mt-2">{t('noBookings')}</p>
                  {tab === 'upcoming' && <Link href="/book" className="btn-primary mt-4">{t('bookUbayam')}</Link>}
                </div>
              ) : list.map((b) => (
                <Link key={b.bookingId} href={`/booking?id=${b.bookingId}`} className="card block p-4 transition hover:shadow-lift md:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold tracking-wide text-crimson">{b.bookingId}</div>
                      <div className="font-display text-[1.1rem] font-bold text-maroon">{tr(b.ubayamType)}</div>
                      <div className="text-ink-soft">{formatDate(b.date, lang, { weekday: true })} · {formatTime(b.time, lang)}</div>
                      <div className="text-ink-soft">{b.bookingType === 'family' ? b.familyName : b.groupName} · {b.memberCount} {t('members')}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="font-bold text-ink">{formatINR(b.amount)}</span>
                      <IconChevronRight className="text-ink-mute" />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2"><BookingBadge b={b} /><PaymentBadge b={b} /></div>
                </Link>
              ))}
          </div>
        </div>
        <FindBooking />
      </div>
    </>
  );
}

function FindBooking() {
  const { t, lang } = usePrefs();
  const router = useRouter();
  const [id, setId] = useState('');
  const [mobile, setMobile] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function find(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (!id.trim()) { setErr(t('err_required')); return; }
    if (!normalizeMobile(mobile)) { setErr(t('err_mobile')); return; }
    setBusy(true);
    try {
      const r = await callFn<LookupBookingInput, { bookingId: string }>('lookupBooking', { bookingId: id.trim(), mobileNumber: mobile }, lang);
      router.push(`/booking?id=${r.bookingId}`);
    } catch (e2) {
      setErr(e2 instanceof AppError ? e2.message : t('err_generic'));
      setBusy(false);
    }
  }

  return (
    <aside>
      <form onSubmit={find} className="card space-y-4 p-5 lg:sticky lg:top-28">
        <div className="flex items-center gap-2 font-display text-lg font-bold text-maroon"><IconSearch /> {t('findBooking')}</div>
        <p className="text-[0.95rem] text-ink-soft">{t('findBookingHelp')}</p>
        <label className="block">
          <span className="field-label">{t('bookingId')}</span>
          <input className="field font-mono uppercase tracking-wider" placeholder="KA26-0001" value={id} onChange={(e) => setId(e.target.value.toUpperCase())} />
        </label>
        <label className="block">
          <span className="field-label">{t('mobileNumber')}</span>
          <input className="field" inputMode="numeric" placeholder="98765 43210" value={mobile} onChange={(e) => setMobile(e.target.value)} />
        </label>
        <ErrorBox>{err}</ErrorBox>
        <button className="btn-primary w-full" disabled={busy}>{busy ? <Spinner /> : <IconSearch />} {t('find')}</button>
      </form>
    </aside>
  );
}
