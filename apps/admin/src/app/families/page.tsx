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
  { key: 'family', label: 'Family name', get: (b) => b.familyName ?? '' },
  { key: 'contact', label: 'Contact person', get: (b) => b.contactName },
  { key: 'mobile', label: 'Mobile', get: (b) => b.mobileNumber },
  { key: 'members', label: 'Members', get: (b) => b.memberCount },
  { key: 'names', label: 'Member names', get: (b) => (b.memberNames ?? []).join(', ') },
  { key: 'date', label: 'Date', get: (b) => b.date },
  { key: 'time', label: 'Time', get: (b) => fmtTime(b.time) },
  { key: 'ubayam', label: 'Ubayam', get: (b) => b.ubayamType.en },
  { key: 'amount', label: 'Amount', get: (b) => b.amount },
  { key: 'payment', label: 'Payment status', get: (b) => paymentStage(b) },
  { key: 'status', label: 'Booking status', get: (b) => b.bookingStatus },
];

export default function FamiliesPage() {
  return <NeedFestival><Families /></NeedFestival>;
}

function Families() {
  const { items, loading, load } = useAllBookings();
  const { days } = useConfig();
  const [q, setQ] = useState('');
  const [dayId, setDayId] = useState('');
  const [showCancelled, setShowCancelled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(() => {
    const n = q.trim().toLowerCase();
    return items.filter((b) => b.bookingType === 'family'
      && (showCancelled || b.bookingStatus !== 'cancelled')
      && (!dayId || b.dayId === dayId)
      && (!n || [b.familyName, b.contactName, b.mobileNumber, b.bookingId].some((v) => v?.toLowerCase().includes(n))));
  }, [items, q, dayId, showCancelled]);
  const members = rows.reduce((s, b) => s + b.memberCount, 0);

  return (
    <>
      <PageHead title="Families" sub={`${rows.length} family bookings · ${members} members`}
        actions={<><Btn onClick={() => load(true)} busy={loading}><IconRefresh size={16} /> Refresh</Btn><ExportButtons rows={rows} cols={cols} name="family-bookings" /></>} />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-gold/15 p-4">
          <Input placeholder="Search family, contact, mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
          <Select value={dayId} onChange={(e) => setDayId(e.target.value)} className="max-w-[14rem]">
            <option value="">All dates</option>
            {days.map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber} · {fmtDate(d.date)}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Show cancelled</label>
        </div>
        {loading && !items.length ? <div className="p-4"><Skeleton className="h-40" /></div> : rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.9rem]">
              <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-4 py-3">Family</th><th className="px-3 py-3">Contact</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3 text-right">Members</th><th className="px-3 py-3">Date · Time</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Payment</th><th className="px-3 py-3">Booking</th></tr>
              </thead>
              <tbody>{rows.map((b) => (
                <tr key={b.bookingId} onClick={() => setOpen(b.bookingId)} className="cursor-pointer border-b border-gold/10 hover:bg-cream/70">
                  <td className="px-4 py-3"><div className="font-semibold">{b.familyName}</div><div className="font-mono text-xs text-crimson">{b.bookingId}</div></td>
                  <td className="px-3 py-3">{b.contactName}</td>
                  <td className="px-3 py-3 font-mono">{b.mobileNumber}</td>
                  <td className="px-3 py-3 text-right">{b.memberCount}</td>
                  <td className="whitespace-nowrap px-3 py-3">{fmtDate(b.date)} · {fmtTime(b.time)}</td>
                  <td className="px-3 py-3 text-right">{formatINR(b.amount)}</td>
                  <td className="px-3 py-3"><PayBadge b={b} /></td>
                  <td className="px-3 py-3"><StatusBadge s={b.bookingStatus} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty>No family bookings.</Empty>}
      </Card>
      <BookingModal bookingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
