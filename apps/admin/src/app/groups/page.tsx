'use client';
import { useMemo, useState } from 'react';
import { formatINR, paymentStage, type Booking } from '@temple/shared';
import { useAllBookings, useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Btn, Card, Empty, ExportButtons, Input, PayBadge, Select, Skeleton, StatusBadge, type Col } from '@/components/ui';
import { BookingModal, fmtDate, fmtTime } from '@/components/booking';
import { IconRefresh } from '@/components/icons';

const cols: Col<Booking>[] = [
  { key: 'id', label: 'Booking ID', get: (b) => b.bookingId },
  { key: 'group', label: 'Group name', get: (b) => b.groupName ?? '' },
  { key: 'contact', label: 'Contact person', get: (b) => b.contactName },
  { key: 'mobile', label: 'Mobile', get: (b) => b.mobileNumber },
  { key: 'families', label: 'Families', get: (b) => (b.families ?? []).map((f) => `${f.familyName} (${f.memberCount})`).join('; ') },
  { key: 'familyCount', label: 'No. of families', get: (b) => b.families?.length ?? 0 },
  { key: 'members', label: 'Total members', get: (b) => b.memberCount },
  { key: 'date', label: 'Date', get: (b) => b.date },
  { key: 'time', label: 'Time', get: (b) => fmtTime(b.time) },
  { key: 'ubayam', label: 'Ubayam', get: (b) => b.ubayamType.en },
  { key: 'amount', label: 'Amount', get: (b) => b.amount },
  { key: 'payment', label: 'Payment status', get: (b) => paymentStage(b) },
  { key: 'status', label: 'Booking status', get: (b) => b.bookingStatus },
];

export default function GroupsPage() {
  return <NeedFestival><Groups /></NeedFestival>;
}

function Groups() {
  const { items, loading, load } = useAllBookings();
  const { days } = useConfig();
  const [q, setQ] = useState('');
  const [dayId, setDayId] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((b) => b.bookingType === 'group' && b.bookingStatus !== 'cancelled'
      && (!dayId || b.dayId === dayId)
      && (!n || [b.groupName, b.contactName, b.mobileNumber, b.bookingId, ...(b.families ?? []).map((f) => f.familyName)].some((v) => v?.toLowerCase().includes(n))));
  }, [items, q, dayId]);

  return (
    <>
      <PageHead title="Groups" sub={`${rows.length} group bookings · ${rows.reduce((s, b) => s + b.memberCount, 0)} members`}
        actions={<><Btn onClick={() => load(true)} busy={loading}><IconRefresh size={16} /> Refresh</Btn><ExportButtons rows={rows} cols={cols} name="group-bookings" /></>} />
      <Card>
        <div className="flex flex-wrap gap-3 border-b border-gold/15 p-4">
          <Input placeholder="Search group, family, contact, mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={dayId} onChange={(e) => setDayId(e.target.value)} className="max-w-[14rem]">
            <option value="">All dates</option>
            {days.map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber} · {fmtDate(d.date)}</option>)}
          </Select>
        </div>
        {loading && !items.length ? <div className="p-4"><Skeleton className="h-40" /></div> : rows.length ? (
          <div className="grid gap-4 p-4 md:grid-cols-2 2xl:grid-cols-3">
            {rows.map((b) => (
              <button key={b.bookingId} onClick={() => setOpen(b.bookingId)} className="rounded-2xl border border-gold/25 bg-white p-4 text-left transition hover:border-gold hover:shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display text-lg font-bold text-maroon">{b.groupName}</div>
                    <div className="text-sm text-ink-soft">{b.contactName} · <span className="font-mono">{b.mobileNumber}</span></div>
                  </div>
                  <span className="font-mono text-xs text-crimson">{b.bookingId}</span>
                </div>
                <ul className="mt-3 space-y-1 rounded-xl bg-cream/70 p-3 text-sm">
                  {(b.families ?? []).map((f, i) => (
                    <li key={i} className="flex justify-between"><span>Family {i + 1} · {f.familyName}</span><span className="font-semibold">{f.memberCount}</span></li>
                  ))}
                  <li className="flex justify-between border-t border-gold/30 pt-1 font-bold text-maroon"><span>Total members</span><span>{b.memberCount}</span></li>
                </ul>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span>{fmtDate(b.date)} · {fmtTime(b.time)} · {formatINR(b.amount)}</span>
                  <span className="flex gap-1.5"><PayBadge b={b} /><StatusBadge s={b.bookingStatus} /></span>
                </div>
              </button>
            ))}
          </div>
        ) : <Empty>No group bookings.</Empty>}
      </Card>
      <BookingModal bookingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
