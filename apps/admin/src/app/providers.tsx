'use client';
import type { ReactNode } from 'react';
import { AuthProvider } from '@/lib/context';
import { AdminShell } from '@/components/shell';
import { UiProvider } from '@/components/ui';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <UiProvider>
        <AdminShell>{children}</AdminShell>
      </UiProvider>
    </AuthProvider>
  );
}
