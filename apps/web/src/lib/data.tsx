'use client';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { collection, doc, onSnapshot, orderBy, query, where, type DocumentData } from 'firebase/firestore';
import type { Booking, Festival, FestivalDay, TempleSettings, TimeSlot, UbayamType } from '@temple/shared';
import { ensureUser, getDb } from './firebase';
import { useAuth } from './auth';

interface TempleData {
  ready: boolean;
  error: boolean;
  settings: TempleSettings | null;
  festival: Festival | null;
  days: FestivalDay[];
  slots: TimeSlot[];
  ubayams: UbayamType[];
}

const Ctx = createContext<TempleData | null>(null);
const withId = <T,>(id: string, d: DocumentData) => ({ id, ...d }) as T;
const CACHE_KEY = 'templeData.v1';

/**
 * One live subscription for all public configuration (≈40 small documents for a whole festival).
 * Slot counts update in real time; a localStorage snapshot paints instantly on repeat visits.
 */
export function TempleDataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TempleData>({ ready: false, error: false, settings: null, festival: null, days: [], slots: [], ubayams: [] });

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.settings) setState((s) => (s.ready ? s : { ...cached, ready: true, error: false }));
    } catch { /* ignore */ }

    const db = getDb();
    const unsubs: (() => void)[] = [];
    let festUnsubs: (() => void)[] = [];
    let currentFest = '';

    const onErr = () => setState((s) => ({ ...s, ready: true, error: !s.settings }));

    unsubs.push(onSnapshot(doc(db, 'settings/public'), (snap) => {
      // An empty answer from the offline cache is "unknown", not "deleted" — keep what we have.
      if (!snap.exists() && snap.metadata.fromCache) return;
      const settings = (snap.data() as TempleSettings) ?? null;
      setState((s) => ({ ...s, settings, ready: true, error: false }));
      const fid = settings?.currentFestivalId || '';
      if (fid === currentFest) return;
      currentFest = fid;
      festUnsubs.forEach((u) => u());
      festUnsubs = [];
      if (!fid) return;
      festUnsubs.push(
        onSnapshot(doc(db, 'festivals', fid), (d) => setState((s) => ({ ...s, festival: d.exists() ? withId<Festival>(d.id, d.data()) : null })), onErr),
        onSnapshot(query(collection(db, 'festivalDays'), where('festivalId', '==', fid)), (q) =>
          (q.empty && q.metadata.fromCache) ? undefined : setState((s) => ({ ...s, days: q.docs.map((d) => withId<FestivalDay>(d.id, d.data())).sort((a, b) => a.dayNumber - b.dayNumber) })), onErr),
        onSnapshot(query(collection(db, 'timeSlots'), where('festivalId', '==', fid)), (q) =>
          (q.empty && q.metadata.fromCache) ? undefined : setState((s) => ({ ...s, slots: q.docs.map((d) => withId<TimeSlot>(d.id, d.data())).sort((a, b) => a.time.localeCompare(b.time)) })), onErr),
        onSnapshot(query(collection(db, 'ubayamTypes'), where('festivalId', '==', fid)), (q) =>
          (q.empty && q.metadata.fromCache) ? undefined : setState((s) => ({ ...s, ubayams: q.docs.map((d) => withId<UbayamType>(d.id, d.data())).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) })), onErr),
      );
    }, onErr));

    return () => { unsubs.forEach((u) => u()); festUnsubs.forEach((u) => u()); };
  }, []);

  useEffect(() => {
    if (!state.settings) return;
    try {
      const { settings, festival, days, slots, ubayams } = state;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ settings, festival, days, slots, ubayams }));
    } catch { /* quota */ }
  }, [state]);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export function useTemple(): TempleData & {
  activeDays: FestivalDay[];
  slotsForDay: (dayId: string) => TimeSlot[];
  ubayamsForDay: (dayId: string) => UbayamType[];
  bookingOpen: boolean;
} {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTemple outside provider');
  return useMemo(() => ({
    ...v,
    activeDays: v.days.filter((d) => d.active),
    slotsForDay: (dayId: string) => v.slots.filter((s) => s.dayId === dayId && s.active),
    ubayamsForDay: (dayId: string) => v.ubayams.filter((u) => u.active && (!u.dayIds?.length || u.dayIds.includes(dayId))),
    bookingOpen: !!v.settings?.bookingOpen && !!v.festival?.active,
  }), [v]);
}

/** Live single booking (readable once the signed-in devotee is in its viewerUids). */
export function useBooking(id: string | null) {
  const uid = useAuth().user?.uid;
  const [booking, setBooking] = useState<Booking | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'missing'>('loading');
  useEffect(() => {
    if (!id) { setStatus('missing'); return; }
    let unsub = () => {};
    let cancelled = false;
    ensureUser().then(() => {
      if (cancelled) return;
      unsub = onSnapshot(doc(getDb(), 'bookings', id), (snap) => {
        if (snap.exists()) { setBooking(snap.data() as Booking); setStatus('ok'); }
        else setStatus('missing');
      }, () => setStatus('missing'));
    }).catch(() => setStatus('missing'));
    return () => { cancelled = true; unsub(); };
  }, [id, uid]);
  return { booking, status };
}

/** All bookings of the signed-in devotee (made on any phone), newest first. */
export function useMyBookings() {
  const uid = useAuth().user?.uid;
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setItems([]);
    setLoading(true);
    let unsub = () => {};
    let cancelled = false;
    ensureUser().then((u) => {
      if (cancelled) return;
      unsub = onSnapshot(
        query(collection(getDb(), 'bookings'), where('viewerUids', 'array-contains', u.uid), orderBy('createdAt', 'desc')),
        (q) => { setItems(q.docs.map((d) => d.data() as Booking)); setLoading(false); },
        () => setLoading(false),
      );
    }).catch(() => setLoading(false));
    return () => { cancelled = true; unsub(); };
  }, [uid]);
  return { items, loading };
}
