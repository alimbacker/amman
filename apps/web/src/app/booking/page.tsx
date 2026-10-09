'use client';
import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  formatDate, formatDateTime, formatINR, formatTime, normalizeTxnId, paymentStage, tsToDate, upiLink, whatsappLink,
  type Booking, type SubmitPaymentInput,
} from '@temple/shared';
import { usePrefs, deviceBookings } from '@/lib/prefs';
import { useBooking, useTemple } from '@/lib/data';
import { AppError, callFn } from '@/lib/firebase';
import { Logo } from '@/components/shell';
import { BookingBadge, DetailRow, ErrorBox, PaymentBadge, QrImage, Skeleton, Spinner, useCopy } from '@/components/ui';
import { IconAlert, IconCheck, IconClock, IconCopy, IconShare, IconUpi, IconWhatsApp } from '@/components/icons';

export default function BookingPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BookingView />
    </Suspense>
  );
}

function Loading() {
  return <div className="mx-auto max-w-xl space-y-4 px-4 pt-10"><Skeleton className="h-24" /><Skeleton className="h-72" /></div>;
}

function BookingView() {
  const id = useSearchParams().get('id');
  const { booking, status } = useBooking(id);
  const { t } = usePrefs();

  useEffect(() => { if (booking) deviceBookings.add(booking.bookingId); }, [booking]);

  if (status === 'loading') return <Loading />;
  if (!booking) {
    return (
      <div className="mx-auto max-w-xl px-4 pt-14 text-center">
        <IconAlert size={44} className="mx-auto text-crimson" />
        <p className="mt-3 text-lg font-semibold text-maroon">{t('findBookingHelp')}</p>
        <Link href="/my-bookings" className="btn-primary mt-6">{t('findBooking')}</Link>
      </div>
    );
  }

  const stage = paymentStage(booking);
  return (
    <div className="mx-auto max-w-5xl px-4 pt-6 md:pt-10">
      {booking.bookingStatus === 'cancelled' ? <Cancelled b={booking} />
        : booking.bookingStatus === 'confirmed' || booking.bookingStatus === 'completed' ? <Confirmed b={booking} />
        : stage === 'verifying' ? <Submitted b={booking} />
        : <Payment b={booking} />}
    </div>
  );
}

/* ------------------------------ shared bits ------------------------------ */

function Details({ b }: { b: Booking }) {
  const { t, tr, lang } = usePrefs();
  return (
    <dl>
      <DetailRow label={t('bookingId')}><span className="font-mono tracking-wide">{b.bookingId}</span></DetailRow>
      <DetailRow label={t('customerName')}>{b.contactName}</DetailRow>
      <DetailRow label={t('familyOrGroup')}>
        {b.bookingType === 'family' ? `${b.familyName} (${t('family')})` : `${b.groupName} (${t('group')})`}
      </DetailRow>
      <DetailRow label={t('date')}>{formatDate(b.date, lang, { weekday: true })}</DetailRow>
      <DetailRow label={t('time')}>{formatTime(b.time, lang)}</DetailRow>
      <DetailRow label={t('ubayam')}>{tr(b.ubayamType)}</DetailRow>
      <DetailRow label={t('members')}>{b.memberCount}</DetailRow>
      {b.bookingType === 'group' && b.families?.length > 0 && (
        <DetailRow label={t('families')}>
          <ul>{b.families.map((f, i) => <li key={i}>{f.familyName} – {f.memberCount}</li>)}</ul>
        </DetailRow>
      )}
      <DetailRow label={t('amount')}>{formatINR(b.amount)}</DetailRow>
      <DetailRow label={t('paymentStatus')}><PaymentBadge b={b} /></DetailRow>
      <DetailRow label={t('bookingStatus')}><BookingBadge b={b} /></DetailRow>
      {b.transactionId && <DetailRow label={t('txnId')}><span className="font-mono">{b.transactionId}</span></DetailRow>}
    </dl>
  );
}

function shareText(b: Booking, templeName: string, lang: 'ta' | 'en', tr: (x: Booking['ubayamType']) => string, t: ReturnType<typeof usePrefs>['t']) {
  return [
    `🙏 ${templeName}`,
    `${t('bookingId')}: ${b.bookingId}`,
    `${t('ubayam')}: ${tr(b.ubayamType)}`,
    `${t('date')}: ${formatDate(b.date, lang, { weekday: true })} · ${formatTime(b.time, lang)}`,
    `${t('members')}: ${b.memberCount}`,
    `${t('bookingStatus')}: ${t(`st_${b.bookingStatus}`)}`,
    typeof window !== 'undefined' ? `${window.location.origin}/booking?id=${b.bookingId}` : '',
  ].filter(Boolean).join('\n');
}

/* ------------------------------ payment ------------------------------ */

function Countdown({ until }: { until: Date }) {
  const [left, setLeft] = useState(until.getTime() - Date.now());
  useEffect(() => {
    const i = setInterval(() => setLeft(until.getTime() - Date.now()), 1000);
    return () => clearInterval(i);
  }, [until]);
  if (left <= 0) return <span>00:00</span>;
  const h = Math.floor(left / 3600_000);
  const m = Math.floor((left % 3600_000) / 60_000);
  const s = Math.floor((left % 60_000) / 1000);
  return <span className="font-mono">{h > 0 ? `${h}:` : ''}{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}</span>;
}

function Payment({ b }: { b: Booking }) {
  const { t, tr, lang } = usePrefs();
  const { settings } = useTemple();
  const [phase, setPhase] = useState<'pay' | 'confirm'>('pay');
  const [txn, setTxn] = useState('');
  const [amount, setAmount] = useState(String(b.amount));
  const [mobile, setMobile] = useState(b.mobileNumber);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, copy] = useCopy();
  const hold = tsToDate(b.holdExpiresAt);
  const upi = settings?.upiId ? upiLink({ upiId: settings.upiId, payeeName: settings.upiPayeeName || tr(settings.templeName), amount: b.amount, note: b.bookingId }) : '';

  async function submit() {
    setErr('');
    if (!normalizeTxnId(txn)) { setErr(t('err_txn')); return; }
    setBusy(true);
    try {
      await callFn<SubmitPaymentInput, unknown>('submitPayment', { bookingId: b.bookingId, mobileNumber: mobile, transactionId: txn, amount: Number(amount) || 0 }, lang);
      // live listener flips the page to "Submitted"
    } catch (e) {
      setErr(e instanceof AppError ? e.message : t('err_generic'));
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <h1 className="font-display text-[1.6rem] font-bold text-maroon md:text-[2rem]">{t('scanPay')}</h1>
        <div className="mt-2 w-28 ornament-rule" />

        {b.paymentStatus === 'rejected' && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
            <div className="font-semibold">{t('st_rejected')}</div>
            {b.rejectionReason && <div>{t('rejectedReason')}: {b.rejectionReason}</div>}
            <div className="mt-1">{t('resubmitPayment')}</div>
          </div>
        )}

        {hold && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-saffron-pale px-4 py-3 font-semibold text-maroon">
            <IconClock size={20} /> <Countdown until={hold} />
            <span className="font-normal text-ink-soft">— {t('holdNotice', { m: settings?.holdMinutes ?? 30 }).split('.')[0]}</span>
          </div>
        )}

        <div className="card mt-4 overflow-hidden">
          <div className="flex items-center justify-between bg-gradient-to-r from-maroon to-crimson-600 px-5 py-4 text-cream">
            <div>
              <div className="text-sm text-cream/80">{t('amountToPay')}</div>
              <div className="font-display text-[2rem] font-bold leading-none text-gold-light">{formatINR(b.amount)}</div>
            </div>
            <div className="text-right text-sm">
              <div className="text-cream/80">{t('bookingId')}</div>
              <div className="font-mono text-lg font-bold">{b.bookingId}</div>
            </div>
          </div>

          {phase === 'pay' ? (
            <div className="p-5 md:p-6">
              <div className="mx-auto w-fit rounded-2xl border-4 border-gold-light bg-white p-3 shadow-card">
                {settings?.upiQrUrl
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={settings.upiQrUrl} alt="UPI QR" className="h-[240px] w-[240px] object-contain" />
                  : upi ? <QrImage value={upi} size={240} /> : <Skeleton className="h-[240px] w-[240px]" />}
              </div>
              <div className="mt-4 text-center">
                <div className="text-ink-soft">{t('payTo')}</div>
                <div className="font-display text-lg font-bold text-maroon">{settings?.upiPayeeName}</div>
                {settings?.upiId && (
                  <button onClick={() => copy(settings.upiId)} className="mt-1 inline-flex items-center gap-2 rounded-full bg-cream-deep px-4 py-2 font-mono font-semibold text-ink">
                    {settings.upiId} <IconCopy size={18} /> <span className="font-body text-sm text-crimson">{copied ? t('copied') : t('copy')}</span>
                  </button>
                )}
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {upi && <a href={upi} className="btn-outline"><IconUpi /> {t('payUsingUpi')}</a>}
                <button className="btn-gold" onClick={() => setPhase('confirm')}><IconCheck /> {t('iHavePaid')}</button>
              </div>
              {settings && tr(settings.upiInstructions) && (
                <div className="mt-5 whitespace-pre-line rounded-xl bg-cream-deep/70 p-4 text-[0.98rem] text-ink-soft">{tr(settings.upiInstructions)}</div>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-5 md:p-6">
              <label className="block">
                <span className="field-label">{t('txnId')}</span>
                <input className="field font-mono text-lg tracking-wider" inputMode="text" autoCapitalize="characters" placeholder="412345678901"
                  value={txn} onChange={(e) => setTxn(e.target.value)} />
                <span className="mt-1 block text-sm text-ink-mute">{t('txnHelp')}</span>
              </label>
              <label className="block">
                <span className="field-label">{t('amountPaid')}</span>
                <div className="flex">
                  <span className="flex items-center rounded-l-xl border-2 border-r-0 border-gold/30 bg-cream-deep px-3 font-semibold">₹</span>
                  <input className="field min-w-0 rounded-l-none" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))} />
                </div>
              </label>
              {/* mobile is pre-filled for the booking device; on a fresh device the devotee re-enters it */}
              {!b.mobileNumber && (
                <label className="block">
                  <span className="field-label">{t('mobileNumber')}</span>
                  <input className="field" inputMode="numeric" value={mobile} onChange={(e) => setMobile(e.target.value)} />
                </label>
              )}
              <ErrorBox>{err}</ErrorBox>
              <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
                <button className="btn-outline" onClick={() => setPhase('pay')}>{t('back')}</button>
                <button className="btn-primary text-lg" disabled={busy} onClick={submit}>{busy ? <Spinner /> : <IconCheck />} {t('submitBooking')}</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <aside>
        <div className="card p-5 lg:sticky lg:top-28">
          <div className="font-display text-lg font-bold text-maroon">{t('summary')}</div>
          <div className="mb-1 mt-2 w-16 ornament-rule" />
          <Details b={b} />
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------ states ------------------------------ */

function Submitted({ b }: { b: Booking }) {
  const { t, lang } = usePrefs();
  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-sky-50 text-sky-700 ring-8 ring-sky-50/60"><IconClock size={40} /></div>
        <h1 className="mt-4 font-display text-[1.7rem] font-bold text-maroon">{t('submittedTitle')}</h1>
        <p className="mt-2 text-[1.05rem] text-ink-soft">{t('submittedBody')}</p>
        <p className="mt-1 text-sm text-ink-mute">{formatDateTime(b.paymentSubmittedAt, lang)}</p>
      </div>
      <div className="card mt-6 p-5"><Details b={b} /></div>
      <p className="mt-4 text-center font-semibold text-maroon">{t('saveBookingId')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Link href="/my-bookings" className="btn-outline">{t('myBookings')}</Link>
        <Link href="/" className="btn-primary">{t('home')}</Link>
      </div>
    </div>
  );
}

function Confirmed({ b }: { b: Booking }) {
  const { t, tr, lang } = usePrefs();
  const { settings } = useTemple();
  const temple = settings ? tr(settings.templeName) : '';
  const text = shareText(b, temple, lang, tr, t);

  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: `${t('confirmedTitle')} · ${b.bookingId}`, text }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard?.writeText(text);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <div className="overflow-hidden rounded-[1.6rem] border-2 border-gold/50 bg-white shadow-lift">
        <div className="relative bg-gradient-to-br from-maroon via-crimson-600 to-maroon-900 px-6 pb-10 pt-7 text-center text-cream">
          <div className="mx-auto w-fit rounded-full bg-cream/10 p-1 ring-2 ring-gold/60"><Logo size={60} /></div>
          <div className="mt-3 font-display text-xl font-bold text-gold-light">{temple}</div>
          <div className="text-sm text-cream/80">{settings ? tr(settings.location) : ''}</div>
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-1.5 font-semibold text-white shadow">
            <IconCheck size={18} /> {b.bookingStatus === 'completed' ? t('st_completed') : t('confirmedTitle')}
          </div>
        </div>
        <div className="-mt-6 flex justify-center">
          <div className="rounded-2xl border-4 border-white bg-white p-2 shadow-card"><QrImage value={b.bookingId} size={150} /></div>
        </div>
        <div className="mt-1 text-center font-mono text-xl font-bold tracking-widest text-maroon">{b.bookingId}</div>
        <div className="relative my-4 border-t-2 border-dashed border-gold/40">
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-cream" />
          <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-cream" />
        </div>
        <div className="px-6 pb-6"><Details b={b} /></div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <button className="btn-primary" onClick={share}><IconShare /> {t('share')}</button>
        <a className="btn bg-[#1F9D55] text-white shadow-lift hover:bg-[#188046]" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">
          <IconWhatsApp /> {t('whatsapp')}
        </a>
      </div>
      {settings?.whatsapp && (
        <a className="btn-ghost mx-auto mt-3 flex w-fit" href={whatsappLink(settings.whatsapp, `${b.bookingId} – `)} target="_blank" rel="noreferrer">{t('contactTemple')}</a>
      )}
    </div>
  );
}

function Cancelled({ b }: { b: Booking }) {
  const { t } = usePrefs();
  return (
    <div className="mx-auto max-w-xl">
      <div className="text-center">
        <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-stone-100 text-stone-600"><IconAlert size={38} /></div>
        <h1 className="mt-4 font-display text-[1.7rem] font-bold text-maroon">{t('st_cancelled')}</h1>
        {b.cancelReason && <p className="mt-1 text-ink-soft">{t('rejectedReason')}: {b.cancelReason}</p>}
      </div>
      <div className="card mt-6 p-5"><Details b={b} /></div>
      <Link href="/book" className="btn-primary mt-5 w-full">{t('bookUbayam')}</Link>
    </div>
  );
}
