'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { User } from 'firebase/auth';
import { onUser, signOutUser } from './firebase';
import { deviceBookings } from './prefs';

interface AuthState {
  /** 'loading' until Firebase has restored the session from this browser. */
  status: 'loading' | 'signedOut' | 'signedIn';
  user: User | null;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

/** Tracks the signed-in devotee. The whole site is gated on it (see AuthGate). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Pick<AuthState, 'status' | 'user'>>({ status: 'loading', user: null });
  useEffect(() => onUser((u) => setState({ status: u ? 'signedIn' : 'signedOut', user: u })), []);
  const value = useMemo<AuthState>(() => ({
    ...state,
    logout: async () => {
      deviceBookings.clear();
      try { sessionStorage.clear(); } catch { /* ignore */ }
      await signOutUser();
    },
  }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

/** Renders `fallback` (the sign-in screen) until a devotee is signed in. */
export function AuthGate({ children, fallback, loading }: { children: ReactNode; fallback: ReactNode; loading: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <>{loading}</>;
  if (status === 'signedOut') return <>{fallback}</>;
  return <>{children}</>;
}
