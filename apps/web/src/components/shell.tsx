'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { whatsappLink, type Lang } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { useAuth } from '@/lib/auth';
import { IconCalendar, IconHelp, IconHome, IconPhone, IconSettings, IconTicket, IconWhatsApp, TempleMark } from './icons';

export function Logo({ size = 44 }: { size?: number }) {
  const { settings } = useTemple();
  if (settings?.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={settings.logoUrl} alt="" width={size} height={size} className="rounded-full border-2 border-gold-light bg-cream object-cover" style={{ width: size, height: size }} />;
  }
  return <TempleMark size={size} />;
}

export function LangToggle({ className = '' }: { className?: string }) {
  const { lang, setLang } = usePrefs();
  const opt = (l: Lang, label: string) => (
    <button
      type="button"
      onClick={() => setLang(l)}
      aria-pressed={lang === l}
      className={`min-h-[2.4rem] rounded-full px-3.5 text-[0.95rem] font-semibold transition ${lang === l ? 'bg-gold-light text-maroon-900' : 'text-cream/85 hover:text-white'}`}
    >
      {label}
    </button>
  );
  return (
    <div className={`flex items-center rounded-full border border-gold/50 bg-maroon-800/40 p-0.5 ${className}`} role="group" aria-label="Language">
      {opt('ta', 'தமிழ்')}
      {opt('en', 'EN')}
    </div>
  );
}

const nav = [
  { href: '/', key: 'home', short: 'home', Icon: IconHome },
  { href: '/book', key: 'bookUbayam', short: 'navBook', Icon: IconCalendar },
  { href: '/my-bookings', key: 'myBookings', short: 'myBookings', Icon: IconTicket },
  { href: '/help', key: 'help', short: 'navHelp', Icon: IconHelp },
] as const;

function Header() {
  const { t, tr } = usePrefs();
  const { settings } = useTemple();
  const { user } = useAuth();
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 bg-gradient-to-b from-maroon to-maroon-700 text-cream shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5 md:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <Logo size={44} />
          <div className="min-w-0 leading-tight">
            <div className="truncate font-display text-[1.05rem] font-bold text-gold-light md:text-[1.2rem]">
              {settings ? tr(settings.templeName) : <span className="skeleton inline-block h-5 w-44 opacity-30" />}
            </div>
            <div className="truncate text-[0.82rem] text-cream/75">{settings ? tr(settings.location) : ''}</div>
          </div>
        </Link>
        <nav className="ml-auto hidden items-center gap-1 whitespace-nowrap xl:flex" aria-label="Main">
          {nav.map(({ href, key }) => (
            <Link key={href} href={href}
              className={`rounded-full px-4 py-2 text-[0.98rem] font-semibold transition ${path === href ? 'bg-cream/15 text-gold-light' : 'text-cream/90 hover:bg-cream/10'}`}>
              {t(key)}
            </Link>
          ))}
          <Link href="/settings" aria-label={t('settings')} title={user?.email ?? ''} className="flex items-center gap-2 rounded-full py-2 pl-3 pr-2.5 text-cream/90 hover:bg-cream/10">
            <span className="max-w-[9rem] truncate text-[0.95rem] font-semibold">{user?.displayName || t('account')}</span><IconSettings />
          </Link>
        </nav>
        <LangToggle className="ml-auto shrink-0 xl:ml-2" />
        <Link href="/settings" aria-label={t('settings')} className="-mr-1 rounded-full p-2 text-cream/90 xl:hidden"><IconSettings /></Link>
      </div>
      <div className="h-[3px] bg-gradient-to-r from-gold-dark via-gold-light to-gold-dark" />
    </header>
  );
}

function BottomNav() {
  const { t } = usePrefs();
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-gold/30 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur xl:hidden">
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {nav.map(({ href, short, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <li key={href}>
              <Link href={href} className={`flex min-h-[4rem] flex-col items-center justify-center gap-0.5 text-[0.74rem] font-semibold leading-tight ${active ? 'text-crimson' : 'text-ink-mute'}`}>
                <span className={`rounded-full px-4 py-1 ${active ? 'bg-saffron-pale' : ''}`}><Icon size={24} /></span>
                <span className="max-w-[5.5rem] truncate">{t(short)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Footer() {
  const { t, tr } = usePrefs();
  const { settings } = useTemple();
  if (!settings) return null;
  return (
    <footer className="mt-16 hidden bg-maroon-900 text-cream/80 lg:block">
      <div className="mx-auto grid max-w-6xl grid-cols-3 gap-8 px-6 py-10">
        <div className="flex items-start gap-3">
          <Logo size={52} />
          <div>
            <div className="font-display text-lg font-bold text-gold-light">{tr(settings.templeName)}</div>
            <div className="text-sm">{tr(settings.address)}</div>
          </div>
        </div>
        <div className="space-y-2 text-sm">
          <div className="font-semibold text-gold-light">{t('contactTemple')}</div>
          {settings.phone && <a className="flex items-center gap-2 hover:text-white" href={`tel:${settings.phone.replace(/\s/g, '')}`}><IconPhone size={18} />{settings.phone}</a>}
          {settings.whatsapp && <a className="flex items-center gap-2 hover:text-white" href={whatsappLink(settings.whatsapp, '')} target="_blank" rel="noreferrer"><IconWhatsApp size={18} />{t('whatsapp')}</a>}
        </div>
        <div className="space-y-2 text-sm">
          <Link href="/temple" className="block hover:text-white">{t('templeInfo')}</Link>
          <Link href="/days" className="block hover:text-white">{t('navaratriDays')}</Link>
          <Link href="/help" className="block hover:text-white">{t('help')}</Link>
        </div>
      </div>
    </footer>
  );
}

/** Splash + first-visit language selection (screens 1 & 2). */
export function LanguageGate() {
  const { langChosen, setLang } = usePrefs();
  const { settings } = useTemple();
  const [show, setShow] = useState(false);
  useEffect(() => setShow(!langChosen), [langChosen]);
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-b from-maroon via-maroon-700 to-maroon-900 px-6 text-center text-cream" role="dialog" aria-modal>
      <div className="rounded-full bg-cream/10 p-3 ring-2 ring-gold/60"><Logo size={96} /></div>
      <h1 className="mt-5 font-display text-[1.7rem] font-bold text-gold-light">{settings?.templeName.ta ?? 'ஸ்ரீ கொன்னை அம்மன் ஆலயம்'}</h1>
      <p className="text-lg text-cream/85">{settings?.templeName.en ?? 'Sri Konnai Amman Temple'}</p>
      <div className="my-7 w-40 ornament-rule" />
      <p className="mb-1 text-lg">உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்</p>
      <p className="mb-6 text-cream/70">Choose your language</p>
      <div className="grid w-full max-w-xs gap-3">
        <button className="btn-gold text-xl" onClick={() => setLang('ta')}>தமிழ்</button>
        <button className="btn border-2 border-gold/60 text-xl text-cream hover:bg-cream/10" onClick={() => setLang('en')}>English</button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <LanguageGate />
      <Header />
      <main className="min-h-[70vh] pb-28 xl:pb-0">{children}</main>
      <Footer />
      <BottomNav />
    </>
  );
}

export function PageTitle({ title, sub, back }: { title: string; sub?: string; back?: string }) {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-2 pt-6 md:pt-10">
      {back && <Link href={back} className="mb-2 inline-flex items-center gap-1 text-maroon/80 hover:text-maroon">← </Link>}
      <h1 className="font-display text-[1.6rem] font-bold text-maroon md:text-[2.1rem]">{title}</h1>
      {sub && <p className="mt-1 text-ink-soft">{sub}</p>}
      <div className="mt-3 w-28 ornament-rule" />
    </div>
  );
}
