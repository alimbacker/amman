'use client';
import type { ReactNode } from 'react';
import { PrefsProvider } from '@/lib/prefs';
import { TempleDataProvider } from '@/lib/data';
import { AuthGate, AuthProvider } from '@/lib/auth';
import { firebaseConfigured } from '@/lib/firebase';
import { AppShell } from '@/components/shell';
import { AuthScreen } from '@/components/auth-screen';

export function Providers({ children }: { children: ReactNode }) {
  if (!firebaseConfigured) return <NotConfigured />;
  return (
    <PrefsProvider>
      <TempleDataProvider>
        <AuthProvider>
          {/* Devotees must sign in before anything else — public config (temple name, logo) still loads behind the gate. */}
          <AuthGate fallback={<AuthScreen />} loading={<Splash />}>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </AuthProvider>
      </TempleDataProvider>
    </PrefsProvider>
  );
}

function Splash() {
  return <div className="grid min-h-screen place-items-center"><span className="h-9 w-9 animate-spin rounded-full border-4 border-crimson border-r-transparent" /></div>;
}

/** Shown instead of a blank crash when the build had no Firebase config (e.g. env vars missing on Vercel). */
function NotConfigured() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-16">
      <h1 className="font-serif text-2xl font-bold text-maroon">Firebase is not configured</h1>
      <p className="mt-3 text-sm leading-6 text-ink/80">
        This build has no Firebase web config. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> variables from{' '}
        <code>apps/web/.env.example</code> to the hosting provider&rsquo;s environment variables (Vercel → Project →
        Settings → Environment Variables), then <strong>redeploy</strong> — the values are baked in at build time, so a
        redeploy is required after adding them.
      </p>
    </main>
  );
}
