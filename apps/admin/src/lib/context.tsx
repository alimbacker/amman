'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth';
import { collection, doc, getDocs, type QuerySnapshot, limit, onSnapshot, orderBy, query, startAfter, where, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import type { Booking, Festival, FestivalDay, TempleSettings, TimeSlot, UbayamType } from '@temple/shared';
import { getAuthInstance, getDb } from './firebase';

/* ------------------------------ auth ------------------------------ */

type AuthState = { status: 'loading' | 'signedOut' | 'denied' | 'admin'; user: User | null };
const AuthCtx = createContext<{ auth: AuthState; login: (e: string, p: string) => Promise<void>; logout: () => Promise<void> } | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ status: 'loading', user: null });
  useEffect(() => onAuthStateChanged(getAuthInstance(), async (u) => {
    if (!u || u.isAnonymous) return setAuth({ status: 'signedOut', user: null });
    const token = await u.getIdTokenResult(true);
    setAuth({ status: token.claims.admin === true ? 'admin' : 'denied', user: u });
  }), []);
  const login = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(getAuthInstance(), email.trim(), password);
  }, []);
  const logout = useCallback(() => signOut(getAuthInstance()), []);
  return <AuthCtx.Provider value={{ auth, login, logout }}>{children}</AuthCtx.Provider>;
}
export function useAuth() {
  const v = useContext(AuthCtx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

/* ------------------------------ config ------------------------------ */

interface Config {
  settings: TempleSettings | null;
  festivals: Festival[];
  festivalId: string;
  festival: Festival | null;
  days: FestivalDay[];
  slots: TimeSlot[];
  ubayams: UbayamType[];
  loaded: boolean;
}
const ConfigCtx = createContext<Config | null>(null);
const withId = <T,>(d: QueryDocumentSnapshot<DocumentData>) => ({ id: d.id, ...d.data() }) as T;

/** Live configuration for the current festival (small: settings + ≈40 docs). Mounted only after admin sign-in. */
export function ConfigProvider({ children }: { children: ReactNode }) {
  const [c, setC] = useState<Config>({ settings: null, festivals: [], festivalId: '', festival: null, days: [], slots: [], ubayams: [], loaded: false });
  useEffect(() => {
    const db = getDb();
    const u1 = onSnapshot(doc(db, 'settings/public'), (s) => setC((p) => ({ ...p, settings: (s.data() as TempleSettings) ?? null, loaded: true })));
    const u2 = onSnapshot(collection(db, 'festivals'), (q) => setC((p) => ({ ...p, festivals: q.docs.map((d) => withId<Festival>(d)).sort((a, b) => b.startDate.localeCompare(a.startDate)) })));
    return () => { u1(); u2(); };
  }, []);
  const fid = c.settings?.currentFestivalId ?? '';
  useEffect(() => {
    if (!fid) return;
    const db = getDb();
    const w = where('festivalId', '==', fid);
    const subs = [
      onSnapshot(query(collection(db, 'festivalDays'), w), (q) => setC((p) => ({ ...p, days: q.docs.map((d) => withId<FestivalDay>(d)).sort((a, b) => a.dayNumber - b.dayNumber) }))),
      onSnapshot(query(collection(db, 'timeSlots'), w), (q) => setC((p) => ({ ...p, slots: q.docs.map((d) => withId<TimeSlot>(d)).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time)) }))),
      onSnapshot(query(collection(db, 'ubayamTypes'), w), (q) => setC((p) => ({ ...p, ubayams: q.docs.map((d) => withId<UbayamType>(d)).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) }))),
    ];
    return () => subs.forEach((u) => u());
  }, [fid]);
  const value = useMemo(() => ({ ...c, festivalId: fid, festival: c.festivals.find((f) => f.id === fid) ?? null }), [c, fid]);
  return <ConfigCtx.Provider value={value}>{children}</ConfigCtx.Provider>;
}
export function useConfig() {
  const v = useContext(ConfigCtx);
  if (!v) throw new Error('useConfig outside provider');
  return v;
}

/* ------------------------------ all bookings (reports) ------------------------------ */

const AllCtx = createContext<{ items: Booking[]; loading: boolean; loadedAt: Date | null; load: (force?: boolean) => Promise<Booking[]> } | null>(null);

/**
 * Full booking list for the current festival, fetched in pages of 500 on demand
 * (Reports, Customers, name search). Cached for the session; "Refresh" re-fetches.
 */
export function AllBookingsProvider({ children }: { children: ReactNode }) {
  const { festivalId } = useConfig();
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);
  const forFid = useRef('');
  const cache = useRef<Booking[]>([]);
  const load = useCallback(async (force = false): Promise<Booking[]> => {
    if (!festivalId) return [];
    if (!force && forFid.current === festivalId) return cache.current;
    setLoading(true);
    try {
      const all: Booking[] = [];
      let cursor: QueryDocumentSnapshot<DocumentData> | null = null;
      for (;;) {
        const q = query(collection(getDb(), 'bookings'), where('festivalId', '==', festivalId), orderBy('createdAt', 'desc'), ...(cursor ? [startAfter(cursor)] : []), limit(500));
        const snap: QuerySnapshot<DocumentData> = await getDocs(q);
        snap.docs.forEach((d) => all.push(d.data() as Booking));
        if (snap.size < 500) break;
        cursor = snap.docs[snap.docs.length - 1];
      }
      forFid.current = festivalId;
      cache.current = all;
      setItems(all);
      setLoadedAt(new Date());
      return all;
    } finally {
      setLoading(false);
    }
  }, [festivalId]);
  return <AllCtx.Provider value={{ items, loading, loadedAt, load }}>{children}</AllCtx.Provider>;
}
export function useAllBookings(autoload = true) {
  const v = useContext(AllCtx);
  if (!v) throw new Error('useAllBookings outside provider');
  const { festivalId } = useConfig();
  useEffect(() => { if (autoload && festivalId) v.load(); }, [autoload, festivalId, v]);
  return v;
}
