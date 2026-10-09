'use client';
import type { ReactNode } from 'react';
import { PrefsProvider } from '@/lib/prefs';
import { TempleDataProvider } from '@/lib/data';
import { AppShell } from '@/components/shell';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <TempleDataProvider>
        <AppShell>{children}</AppShell>
      </TempleDataProvider>
    </PrefsProvider>
  );
}
