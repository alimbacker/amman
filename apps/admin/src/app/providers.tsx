'use client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/context';
import { firebaseConfigured } from '@/lib/firebase';
import { AdminShell } from '@/components/shell';
import { UiProvider } from '@/components/ui';

export function Providers({ children }: { children: ReactNode }) {
  if (!firebaseConfigured) return <NotConfigured />;
  return (
    <AuthProvider>
      <UiProvider>
        <AdminShell>{children}</AdminShell>
      </UiProvider>
    </AuthProvider>
  );
}

/** Shown instead of a blank crash when the build had no Firebase config (e.g. env vars missing on Vercel). */
function NotConfigured() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-16">
      <h1 className="font-serif text-2xl font-bold text-maroon">Firebase is not configured</h1>
      <p className="mt-3 text-sm leading-6 text-ink/80">
        This build has no Firebase web config. Add the <code>NEXT_PUBLIC_FIREBASE_*</code> variables from{' '}
        <code>apps/admin/.env.example</code> to the hosting provider&rsquo;s environment variables (Vercel → Project →
        Settings → Environment Variables), then <strong>redeploy</strong> — the values are baked in at build time, so a
        redeploy is required after adding them.
      </p>
    </main>
  );
}
