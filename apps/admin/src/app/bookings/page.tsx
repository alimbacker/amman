'use client';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAfter, where, type DocumentData, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { normalizeMobile, paymentStage, type Booking } from '@temple/shared';
import { getDb } from '@/lib/firebase';
import { useAllBookings, useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Btn, Card, Empty, Input, Select, Skeleton } from '@/components/ui';
import { BookingList, BookingModal, fmtDate, fmtTime } from '@/components/booking';
import { IconRefresh, IconSearch } from '@/components/icons';

const PAGE = 30;
type Filters = { dayId: string; slotId: string; pay: string; status: string; type: string };

export default function BookingsPage() {
  return <NeedFestival><Suspense><Bookings /></Suspense></NeedFestival>;
}

function Bookings() {
  const params = useSearchParams();
  const { festivalId, days, slots } = useConfig();
  const all = useAllBookings(false);
  const [f, setF] = useState<Filters>({ dayId: '', slotId: '', pay: params.get('pay') ?? '', status: params.get('bookingStatus') ?? '', type: params.get('type') ?? '' });
  const [items, setItems] = useState<Booking[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchResult, setSearchResult] = useState<Booking[] | null>(null);
  const [open, setOpen] = useState<string | null>(params.get('id'));

  /** Client-side checks for the filters Firestore did not apply (one status filter is applied server-side). */
  const matches = useCallback((b: Booking) =>
    (!f.status || b.bookingStatus === f.status) &&
    (!f.type || b.bookingType === f.type) &&
    (!f.pay || (['awaiting_payment', 'verifying'].includes(f.pay) ? paymentStage(b) === f.pay : b.paymentStatus === f.pay)), [f]);

  const fetchPage = useCallback(async (after: QueryDocumentSnapshot<DocumentData> | null) => {
    setLoading(true);
    try {
      const c: QueryConstraint[] = [where('festivalId', '==', festivalId)];
      if (f.slotId) c.push(where('slotId', '==', f.slotId));
      else if (f.dayId) c.push(where('dayId', '==', f.dayId));
      const payServer = f.pay === 'awaiting_payment' || f.pay === 'verifying' ? 'pending' : f.pay;
      if (payServer) c.push(where('paymentStatus', '==', payServer));
      else if (f.status) c.push(where('bookingStatus', '==', f.status));
      else if (f.type) c.push(where('bookingType', '==', f.type));
      c.push(orderBy('createdAt', 'desc'));
      if (after) c.push(startAfter(after));
      c.push(limit(PAGE));
      const snap = await getDocs(query(collection(getDb(), 'bookings'), ...c));
      const rows = snap.docs.map((d) => d.data() as Booking).filter(matches);
      setItems((p) => (after ? [...p, ...rows] : rows));
      setCursor(snap.docs[snap.docs.length - 1] ?? null);
      setMore(snap.size === PAGE);
    } finally {
      setLoading(false);
    }
  }, [festivalId, f, matches]);

  useEffect(() => { fetchPage(null); }, [fetchPage]);

  async function runSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const q = search.trim();
    if (!q) { setSearchResult(null); return; }
    setLoading(true);
    try {
      if (/^[A-Z]{1,6}\d{2}-\d{3,}$/i.test(q)) {
        const s = await getDoc(doc(getDb(), 'bookings', q.toUpperCase()));
        setSearchResult(s.exists() ? [s.data() as Booking] : []);
      } else if (normalizeMobile(q)) {
        const s = await getDocs(query(collection(getDb(), 'bookings'), where('mobileNumber', '==', normalizeMobile(q)), orderBy('createdAt', 'desc'), limit(50)));
        setSearchResult(s.docs.map((d) => d.data() as Booking));
      } else {
        const everything = await all.load();
        const needle = q.toLowerCase();
        setSearchResult(everything.filter((b) => [b.contactName, b.familyName, b.groupName, b.transactionId, ...(b.families ?? []).map((x) => x.familyName)]
          .some((v) => v?.toLowerCase().includes(needle))).slice(0, 100));
      }
    } finally {
      setLoading(false);
    }
  }

  const daySlots = useMemo(() => slots.filter((s) => !f.dayId || s.dayId === f.dayId), [slots, f.dayId]);
  const set = (p: Partial<Filters>) => { setSearchResult(null); setF((x) => ({ ...x, ...p })); };
  const list = searchResult ?? items;

  return (
    <>
      <PageHead title="Bookings" actions={<><Btn onClick={() => fetchPage(null)} busy={loading}><IconRefresh size={16} /> Refresh</Btn><Link href="/bookings/new"><Btn kind="primary">+ Manual booking</Btn></Link></>} />
      <Card>
        <div className="grid gap-3 border-b border-gold/15 p-4 md:grid-cols-2 xl:grid-cols-[2fr_repeat(5,1fr)]">
          <form onSubmit={runSearch} className="flex gap-2">
            <Input placeholder="Booking ID, mobile, name, family, UTR…" value={search} onChange={(e) => { setSearch(e.target.value); if (!e.target.value) setSearchResult(null); }} />
            <Btn type="submit" kind="primary" aria-label="Search"><IconSearch size={18} /></Btn>
          </form>
          <Select value={f.dayId} onChange={(e) => set({ dayId: e.target.value, slotId: '' })} aria-label="Date">
            <option value="">All dates</option>
            {days.map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber} · {fmtDate(d.date)}</option>)}
          </Select>
          <Select value={f.slotId} onChange={(e) => set({ slotId: e.target.value })} aria-label="Slot">
            <option value="">All slots</option>
            {daySlots.map((s) => <option key={s.id} value={s.id}>{f.dayId ? '' : `D${days.find((d) => d.id === s.dayId)?.dayNumber ?? '?'} · `}{fmtTime(s.time)}</option>)}
          </Select>
          <Select value={f.pay} onChange={(e) => set({ pay: e.target.value })} aria-label="Payment status">
            <option value="">Any payment</option>
            <option value="verifying">To verify</option>
            <option value="awaiting_payment">Awaiting payment</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </Select>
          <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Booking status">
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
          <Select value={f.type} onChange={(e) => set({ type: e.target.value })} aria-label="Type">
            <option value="">Family & group</option>
            <option value="family">Family</option>
            <option value="group">Group</option>
          </Select>
        </div>
        {searchResult && <div className="border-b border-gold/15 bg-saffron-pale/60 px-4 py-2 text-sm">{searchResult.length} result(s) for “{search}” · <button className="font-semibold text-crimson underline" onClick={() => { setSearch(''); setSearchResult(null); }}>clear</button></div>}
        {loading && !list.length ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          : list.length ? <BookingList items={list} onOpen={setOpen} /> : <Empty>No bookings match.</Empty>}
        {!searchResult && more && (
          <div className="border-t border-gold/15 p-4 text-center"><Btn onClick={() => fetchPage(cursor)} busy={loading}>Load more</Btn></div>
        )}
      </Card>
      <BookingModal bookingId={open} onClose={() => { setOpen(null); fetchPage(null); }} />
    </>
  );
}
