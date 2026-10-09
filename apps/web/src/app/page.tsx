'use client';
import Link from 'next/link';
import { formatDate, whatsappLink } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { Logo } from '@/components/shell';
import { DayCard, todayYmd } from '@/components/days';
import { Skeleton } from '@/components/ui';
import { Gopuram, IconCalendar, IconInfo, IconMapPin, IconPhone, IconTicket, IconWhatsApp } from '@/components/icons';

export default function HomePage() {
  const { t, tr, lang } = usePrefs();
  const { settings, festival, activeDays, bookingOpen, ready, error } = useTemple();
  const today = todayYmd();

  if (ready && error) {
    return <div className="mx-auto max-w-lg px-4 py-20 text-center text-ink-soft">{t('err_offline')}</div>;
  }

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-gradient-to-br from-maroon via-crimson-600 to-maroon-900 text-cream">
        {settings?.heroImageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.heroImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" loading="eager" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(232,196,104,.28),transparent_55%)]" />
        <Gopuram className="pointer-events-none absolute -bottom-2 right-[-6%] h-[78%] text-gold-light/15 md:right-[4%] md:h-[92%] md:text-gold-light/20" />
        <div className="relative mx-auto max-w-6xl px-5 pb-12 pt-9 md:pb-20 md:pt-16">
          <div className="flex items-center gap-4">
            <div className="rounded-full bg-cream/10 p-1.5 ring-2 ring-gold/60"><Logo size={72} /></div>
            <div className="hidden h-px flex-1 bg-gradient-to-r from-gold-light/70 to-transparent md:block" />
          </div>
          {settings ? (
            <>
              <h1 className="mt-5 max-w-2xl font-display text-[2rem] font-bold leading-tight text-gold-light md:text-[3.2rem]">
                {settings.templeName.ta}
              </h1>
              <p className="mt-1 text-[1.15rem] font-medium text-cream/90 md:text-[1.4rem]">{settings.templeName.en}</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-cream/10 px-3 py-1 text-cream/90 ring-1 ring-gold/40">
                <IconMapPin size={18} /> {tr(settings.location)}
              </p>
            </>
          ) : (
            <div className="mt-6 space-y-3"><Skeleton className="h-10 w-72 opacity-30" /><Skeleton className="h-6 w-56 opacity-30" /></div>
          )}

          {festival && (
            <div className="mt-7 max-w-xl rounded-2xl border border-gold/40 bg-maroon-900/35 p-4 backdrop-blur-sm md:p-5">
              <div className="text-[0.85rem] font-semibold uppercase tracking-wider text-gold-light/90">{t('appTagline')}</div>
              <div className="mt-1 font-display text-[1.35rem] font-bold text-cream md:text-[1.6rem]">{tr(festival.name)}</div>
              <div className="mt-1 flex items-center gap-2 text-cream/85">
                <IconCalendar size={18} />
                {formatDate(festival.startDate, lang, { year: false })} – {formatDate(festival.endDate, lang)}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {bookingOpen || !ready ? (
              <Link href="/book" className="btn-gold min-h-[3.75rem] px-8 text-[1.2rem]">
                <IconCalendar /> {t('bookUbayam')}
              </Link>
            ) : (
              <div className="rounded-2xl bg-cream/10 px-5 py-4 font-semibold text-gold-light ring-1 ring-gold/40">{t('bookingClosed')}</div>
            )}
            <Link href="/my-bookings" className="btn min-h-[3.75rem] border-2 border-gold/50 text-cream hover:bg-cream/10">
              <IconTicket /> {t('myBookings')}
            </Link>
          </div>
        </div>
        <div className="h-[3px] bg-gradient-to-r from-gold-dark via-gold-light to-gold-dark" />
      </section>

      {/* ---------- Quick actions (mobile) ---------- */}
      <section className="mx-auto -mt-1 grid max-w-6xl grid-cols-2 gap-3 px-4 pt-6 md:hidden">
        <QuickTile href="/temple" icon={<IconInfo size={26} />} label={t('templeInfo')} />
        {settings?.whatsapp ? (
          <QuickTile href={whatsappLink(settings.whatsapp, tr(settings.templeName))} external icon={<IconWhatsApp size={26} />} label={t('contactTemple')} />
        ) : (
          <QuickTile href="/help" icon={<IconPhone size={26} />} label={t('contactTemple')} />
        )}
      </section>

      {/* ---------- Navaratri information ---------- */}
      {festival && (
        <section className="mx-auto mt-8 max-w-6xl px-4 md:mt-14">
          <div className="card relative overflow-hidden p-5 md:p-8">
            <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-gold-light via-saffron to-crimson" />
            <h2 className="font-display text-[1.35rem] font-bold text-maroon md:text-[1.7rem]">{t('nineDays')}</h2>
            <p className="mt-2 max-w-3xl whitespace-pre-line text-[1.05rem] text-ink-soft">{tr(festival.description)}</p>
          </div>
        </section>
      )}

      {/* ---------- 9 days ---------- */}
      <section className="mx-auto mt-8 max-w-6xl px-4 md:mt-12">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="font-display text-[1.35rem] font-bold text-maroon md:text-[1.7rem]">{t('navaratriDays')}</h2>
          <Link href="/days" className="font-semibold text-crimson hover:underline">{t('next')} →</Link>
        </div>
        {!ready && !activeDays.length ? (
          <div className="grid gap-3 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-32" />)}</div>
        ) : activeDays.length ? (
          <div className="grid gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {activeDays.map((d) => <DayCard key={d.id} day={d} past={d.date < today} />)}
          </div>
        ) : (
          <div className="card p-6 text-center text-ink-soft">{t('noFestival')}</div>
        )}
      </section>

      {/* ---------- Contact ---------- */}
      {settings && (
        <section className="mx-auto mt-10 max-w-6xl px-4 md:mt-14">
          <div className="card flex flex-col gap-4 bg-gradient-to-br from-white to-saffron-pale p-5 md:flex-row md:items-center md:p-7">
            <div className="flex-1">
              <h2 className="font-display text-[1.3rem] font-bold text-maroon">{t('contactTemple')}</h2>
              <p className="mt-1 text-ink-soft">{tr(settings.address)}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {settings.whatsapp && (
                <a href={whatsappLink(settings.whatsapp, tr(settings.templeName))} target="_blank" rel="noreferrer" className="btn bg-[#1F9D55] text-white shadow-lift hover:bg-[#188046]">
                  <IconWhatsApp /> {t('whatsapp')}
                </a>
              )}
              {settings.phone && (
                <a href={`tel:${settings.phone.replace(/\s/g, '')}`} className="btn-outline"><IconPhone /> {t('call')}</a>
              )}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function QuickTile({ href, icon, label, external }: { href: string; icon: React.ReactNode; label: string; external?: boolean }) {
  const cls = 'card flex min-h-[5.5rem] flex-col items-start justify-center gap-1.5 p-4 font-semibold text-maroon active:scale-[.98]';
  return external
    ? <a href={href} target="_blank" rel="noreferrer" className={cls}><span className="text-crimson">{icon}</span>{label}</a>
    : <Link href={href} className={cls}><span className="text-crimson">{icon}</span>{label}</Link>;
}
