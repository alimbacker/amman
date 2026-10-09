'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { AllBookingsProvider, ConfigProvider, useAuth, useConfig } from '@/lib/context';
import { Btn } from './ui';
import {
  IconBell, IconCalendar, IconChart, IconClock, IconFamily, IconFlag, IconGrid, IconLayers, IconLogout, IconMenu,
  IconRupee, IconSettings, IconTicket, IconUser, IconUsers, TempleMark,
} from './icons';

export const MENU = [
  { href: '/', label: 'Dashboard', Icon: IconGrid },
  { href: '/bookings', label: 'Bookings', Icon: IconTicket },
  { href: '/customers', label: 'Customers', Icon: IconUser },
  { href: '/families', label: 'Families', Icon: IconFamily },
  { href: '/groups', label: 'Groups', Icon: IconUsers },
  { href: '/festival', label: 'Festival', Icon: IconFlag },
  { href: '/days', label: 'Days', Icon: IconCalendar },
  { href: '/slots', label: 'Time Slots', Icon: IconClock },
  { href: '/ubayam-types', label: 'Ubayam Types', Icon: IconLayers },
  { href: '/payments', label: 'Payments', Icon: IconRupee },
  { href: '/reports', label: 'Reports', Icon: IconChart },
  { href: '/notifications', label: 'Notifications', Icon: IconBell },
  { href: '/settings', label: 'Settings', Icon: IconSettings },
] as const;

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const path = usePathname();
  const { auth, logout } = useAuth();
  const { settings, festival } = useConfig();
  return (
    <div className="flex h-full flex-col bg-gradient-to-b from-maroon to-maroon-900 text-cream">
      <div className="flex items-center gap-3 px-5 py-5">
        <TempleMark size={42} />
        <div className="min-w-0 leading-tight">
          <div className="truncate font-display font-bold text-gold-light">{settings?.templeName.en ?? 'Temple'}</div>
          <div className="truncate text-xs text-cream/70">Admin · {festival?.name.en ?? 'No festival selected'}</div>
        </div>
      </div>
      <div className="mx-5 h-px bg-gradient-to-r from-gold/60 to-transparent" />
      <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Admin">
        {MENU.map(({ href, label, Icon }) => {
          const active = href === '/' ? path === '/' : path.startsWith(href);
          return (
            <Link key={href} href={href} onClick={onNavigate}
              className={`mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[0.93rem] font-medium transition ${active ? 'bg-cream text-maroon shadow' : 'text-cream/85 hover:bg-cream/10'}`}>
              <Icon size={19} className={active ? 'text-crimson' : 'text-gold-light/80'} /> {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-cream/10 px-5 py-4 text-xs text-cream/70">
        <div className="truncate">{auth.user?.email}</div>
        <button onClick={logout} className="mt-2 inline-flex items-center gap-2 font-semibold text-gold-light hover:text-white"><IconLogout size={16} /> Sign out</button>
      </div>
    </div>
  );
}

function Frame({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const title = MENU.find((m) => (m.href === '/' ? path === '/' : path.startsWith(m.href)))?.label ?? '';
  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block"><Sidebar /></aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <aside className="absolute inset-y-0 left-0 w-72" onClick={(e) => e.stopPropagation()}><Sidebar onNavigate={() => setOpen(false)} /></aside>
        </div>
      )}
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-gold/20 bg-cream/90 px-4 py-3 backdrop-blur lg:hidden">
        <button onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-maroon" aria-label="Menu"><IconMenu /></button>
        <div className="font-display font-bold text-maroon">{title}</div>
      </header>
      <main className="mx-auto max-w-[1400px] px-4 py-5 md:px-8 md:py-8">{children}</main>
    </div>
  );
}

/** Guards every page except /login: requires a signed-in user with the `admin` custom claim. */
export function AdminShell({ children }: { children: ReactNode }) {
  const { auth, logout } = useAuth();
  const path = usePathname();
  const router = useRouter();
  const isLogin = path === '/login';

  useEffect(() => {
    if (auth.status === 'signedOut' && !isLogin) router.replace('/login');
    if (auth.status === 'admin' && isLogin) router.replace('/');
  }, [auth.status, isLogin, router]);

  if (isLogin) return <>{children}</>;
  if (auth.status === 'loading' || auth.status === 'signedOut') {
    return <div className="grid min-h-screen place-items-center"><span className="h-8 w-8 animate-spin rounded-full border-4 border-crimson border-r-transparent" /></div>;
  }
  if (auth.status === 'denied') {
    return (
      <div className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="font-display text-2xl font-bold text-maroon">Not authorised</h1>
          <p className="mt-2 text-ink-soft">{auth.user?.email} is not an admin. Ask the temple administrator to grant access.</p>
          <Btn className="mt-5" onClick={logout}>Sign out</Btn>
        </div>
      </div>
    );
  }
  return (
    <ConfigProvider>
      <AllBookingsProvider>
        <Frame>{children}</Frame>
      </AllBookingsProvider>
    </ConfigProvider>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[1.6rem] font-bold text-maroon">{title}</h1>
        {sub && <div className="mt-0.5 text-ink-soft">{sub}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Shown on pages that need a current festival. */
export function NeedFestival({ children }: { children: ReactNode }) {
  const { festivalId, loaded } = useConfig();
  if (!loaded) return null;
  if (!festivalId) {
    return (
      <div className="rounded-2xl border border-gold/30 bg-white p-8 text-center">
        <p className="text-ink-soft">No current festival is selected.</p>
        <Link href="/festival" className="mt-3 inline-block font-semibold text-crimson underline">Create or select a festival</Link>
      </div>
    );
  }
  return <>{children}</>;
}
