'use client';
import { useMemo, useState } from 'react';
import { formatINR, paymentStage, tsToDate, type Booking } from '@temple/shared';
import { useAllBookings, useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Btn, Card, Empty, ExportButtons, Skeleton, exportXlsx, type Col } from '@/components/ui';
import { fmtDate, fmtTime, who } from '@/components/booking';
import { IconRefresh } from '@/components/icons';

type Tab = 'daily' | 'date' | 'slot' | 'family' | 'group' | 'payment' | 'revenue';
type Row = Record<string, string | number>;

const istDay = (b: Booking) => {
  const d = tsToDate(b.createdAt);
  return d ? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d) : '';
};
const active = (b: Booking) => b.bookingStatus !== 'cancelled';
const paid = (b: Booking) => b.paymentStatus === 'paid';

const detailCols: Col<Booking>[] = [
  { key: 'id', label: 'Booking ID', get: (b) => b.bookingId },
  { key: 'type', label: 'Type', get: (b) => b.bookingType },
  { key: 'who', label: 'Family / Group', get: (b) => who(b) },
  { key: 'families', label: 'Families', get: (b) => (b.families ?? []).map((f) => `${f.familyName} (${f.memberCount})`).join('; ') },
  { key: 'contact', label: 'Contact', get: (b) => b.contactName },
  { key: 'mobile', label: 'Mobile', get: (b) => b.mobileNumber },
  { key: 'members', label: 'Members', get: (b) => b.memberCount },
  { key: 'day', label: 'Day', get: (b) => b.dayNumber },
  { key: 'date', label: 'Date', get: (b) => b.date },
  { key: 'time', label: 'Time', get: (b) => fmtTime(b.time) },
  { key: 'ubayam', label: 'Ubayam', get: (b) => b.ubayamType.en },
  { key: 'amount', label: 'Amount', get: (b) => b.amount },
  { key: 'payment', label: 'Payment', get: (b) => paymentStage(b) },
  { key: 'status', label: 'Booking status', get: (b) => b.bookingStatus },
  { key: 'utr', label: 'UTR', get: (b) => b.transactionId ?? '' },
  { key: 'note', label: 'Prayer note', get: (b) => b.note ?? '' },
];
const paymentCols: Col<Booking>[] = [
  { key: 'id', label: 'Booking ID', get: (b) => b.bookingId },
  { key: 'contact', label: 'Name', get: (b) => b.contactName },
  { key: 'mobile', label: 'Mobile', get: (b) => b.mobileNumber },
  { key: 'amount', label: 'Expected', get: (b) => b.amount },
  { key: 'paidAmt', label: 'Entered by devotee', get: (b) => b.amountPaid ?? '' },
  { key: 'utr', label: 'UTR', get: (b) => b.transactionId ?? '' },
  { key: 'mode', label: 'Mode', get: (b) => b.paymentMode },
  { key: 'stage', label: 'Payment', get: (b) => paymentStage(b) },
  { key: 'status', label: 'Booking', get: (b) => b.bookingStatus },
  { key: 'verifiedBy', label: 'Verified by', get: (b) => b.verifiedBy ?? '' },
];

export default function ReportsPage() {
  return <NeedFestival><Reports /></NeedFestival>;
}

function Reports() {
  const { items, loading, load, loadedAt } = useAllBookings();
  const { slots, days, festival } = useConfig();
  const [tab, setTab] = useState<Tab>('date');
  const [withCancelled, setWithCancelled] = useState(false);
  const base = useMemo(() => (withCancelled ? items : items.filter(active)), [items, withCancelled]);

  const summary = useMemo((): { cols: Col<Row>[]; rows: Row[] } => {
    const agg = (rows: Booking[]) => ({
      bookings: rows.length, members: rows.reduce((s, b) => s + b.memberCount, 0),
      families: rows.filter((b) => b.bookingType === 'family').length, groups: rows.filter((b) => b.bookingType === 'group').length,
      confirmed: rows.filter((b) => b.bookingStatus === 'confirmed' || b.bookingStatus === 'completed').length,
      pending: rows.filter((b) => b.bookingStatus === 'pending').length,
      cancelled: rows.filter((b) => b.bookingStatus === 'cancelled').length,
      revenue: rows.filter(paid).reduce((s, b) => s + b.amount, 0),
    });
    const num = (key: string, label: string, money = false): Col<Row> => ({ key, label, get: (r) => (money ? Number(r[key]) : r[key]) });
    const std = [num('bookings', 'Bookings'), num('members', 'Members'), num('families', 'Families'), num('groups', 'Groups'), num('confirmed', 'Confirmed'), num('pending', 'Pending'), ...(withCancelled ? [num('cancelled', 'Cancelled')] : []), num('revenue', 'Revenue (₹)', true)];

    if (tab === 'daily') {
      const by = new Map<string, Booking[]>();
      base.forEach((b) => { const k = istDay(b); by.set(k, [...(by.get(k) ?? []), b]); });
      return { cols: [{ key: 'day', label: 'Booked on', get: (r) => r.day }, ...std], rows: [...by.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([day, rs]) => ({ day, ...agg(rs) })) };
    }
    if (tab === 'date') {
      return { cols: [{ key: 'day', label: 'Festival day', get: (r) => r.day }, { key: 'date', label: 'Date', get: (r) => r.date }, ...std],
        rows: days.map((d) => ({ day: `Day ${d.dayNumber}`, date: d.date, ...agg(base.filter((b) => b.dayId === d.id)) })) };
    }
    if (tab === 'slot') {
      return {
        cols: [{ key: 'day', label: 'Day', get: (r) => r.day }, { key: 'date', label: 'Date', get: (r) => r.date }, { key: 'time', label: 'Time', get: (r) => r.time },
          { key: 'capacity', label: 'Capacity', get: (r) => r.capacity }, { key: 'held', label: 'Booked (live)', get: (r) => r.held }, { key: 'remaining', label: 'Remaining', get: (r) => r.remaining }, ...std],
        rows: slots.map((s) => ({ day: `Day ${days.find((d) => d.id === s.dayId)?.dayNumber ?? '?'}`, date: s.date, time: fmtTime(s.time), capacity: s.capacity, held: s.bookedCount, remaining: Math.max(0, s.capacity - s.bookedCount), ...agg(base.filter((b) => b.slotId === s.id)) })),
      };
    }
    if (tab === 'revenue') {
      const by = new Map<string, Booking[]>();
      base.filter(paid).forEach((b) => { const k = `${b.ubayamType.en}|${b.paymentMode}`; by.set(k, [...(by.get(k) ?? []), b]); });
      const rows: Row[] = [...by.entries()].map(([k, rs]) => ({ ubayam: k.split('|')[0], mode: k.split('|')[1].toUpperCase(), bookings: rs.length, members: rs.reduce((s, b) => s + b.memberCount, 0), revenue: rs.reduce((s, b) => s + b.amount, 0) }))
        .sort((a, b) => Number(b.revenue) - Number(a.revenue));
      rows.push({ ubayam: 'TOTAL', mode: '', bookings: rows.reduce((s, r) => s + Number(r.bookings), 0), members: rows.reduce((s, r) => s + Number(r.members), 0), revenue: rows.reduce((s, r) => s + Number(r.revenue), 0) });
      return { cols: [{ key: 'ubayam', label: 'Ubayam', get: (r) => r.ubayam }, { key: 'mode', label: 'Mode', get: (r) => r.mode }, num('bookings', 'Paid bookings'), num('members', 'Members'), num('revenue', 'Revenue (₹)', true)], rows };
    }
    return { cols: [], rows: [] };
  }, [tab, base, days, slots, withCancelled]);

  const detail = useMemo(() => {
    if (tab === 'family') return { rows: base.filter((b) => b.bookingType === 'family'), cols: detailCols };
    if (tab === 'group') return { rows: base.filter((b) => b.bookingType === 'group'), cols: detailCols };
    if (tab === 'payment') return { rows: base, cols: paymentCols };
    return null;
  }, [tab, base]);

  const tabs: [Tab, string][] = [['daily', 'Daily bookings'], ['date', 'Date-wise'], ['slot', 'Slot-wise'], ['family', 'Family bookings'], ['group', 'Group bookings'], ['payment', 'Payment report'], ['revenue', 'Revenue']];
  const fileName = `${festival?.id ?? 'festival'}-${tab}-report`;
  const totalRevenue = items.filter(paid).reduce((s, b) => s + b.amount, 0);

  return (
    <>
      <PageHead title="Reports" sub={<>{items.length} bookings loaded · paid revenue {formatINR(totalRevenue)}{loadedAt && <> · {loadedAt.toLocaleTimeString('en-IN')}</>}</>}
        actions={<>
          <Btn onClick={() => load(true)} busy={loading}><IconRefresh size={16} /> Refresh</Btn>
          {detail ? <ExportButtons rows={detail.rows} cols={detail.cols} name={fileName} /> : <ExportButtons rows={summary.rows} cols={summary.cols} name={fileName} />}
          <Btn onClick={() => exportXlsx(items, detailCols, `${festival?.id ?? 'festival'}-all-bookings`)} disabled={!items.length}>All bookings (Excel)</Btn>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-crimson text-white shadow' : 'bg-white text-ink-soft ring-1 ring-gold/30 hover:ring-gold'}`}>{label}</button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-sm"><input type="checkbox" checked={withCancelled} onChange={(e) => setWithCancelled(e.target.checked)} /> Include cancelled</label>
      </div>
      <Card>
        {loading && !items.length ? <div className="p-4"><Skeleton className="h-60" /></div> : detail ? (
          detail.rows.length ? (
            <div className="max-h-[70vh] overflow-auto">
              <table className="w-full text-left text-[0.86rem]">
                <thead className="sticky top-0 bg-white text-[0.72rem] uppercase tracking-wide text-ink-mute shadow-sm">
                  <tr>{detail.cols.map((c) => <th key={c.key} className="whitespace-nowrap px-3 py-2.5">{c.label}</th>)}</tr>
                </thead>
                <tbody>{detail.rows.map((b) => (
                  <tr key={b.bookingId} className="border-t border-gold/10">{detail.cols.map((c) => <td key={c.key} className="whitespace-nowrap px-3 py-2">{String(c.get(b))}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          ) : <Empty>No data.</Empty>
        ) : summary.rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.9rem]">
              <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
                <tr>{summary.cols.map((c) => <th key={c.key} className="whitespace-nowrap px-4 py-3">{c.label}</th>)}</tr>
              </thead>
              <tbody>{summary.rows.map((r, i) => (
                <tr key={i} className={`border-b border-gold/10 ${r.ubayam === 'TOTAL' ? 'bg-gold-pale/50 font-bold' : ''}`}>
                  {summary.cols.map((c) => <td key={c.key} className="whitespace-nowrap px-4 py-2.5">{c.key === 'revenue' ? formatINR(Number(r[c.key])) : c.key === 'date' ? fmtDate(String(r[c.key])) : String(c.get(r))}</td>)}
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <Empty>No data.</Empty>}
      </Card>
    </>
  );
}
