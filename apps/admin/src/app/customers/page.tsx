'use client';
import { Fragment, useMemo, useState } from 'react';
import { formatINR, type Booking } from '@temple/shared';
import { useAllBookings } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Btn, Card, Empty, ExportButtons, Input, Skeleton, type Col } from '@/components/ui';
import { BookingModal } from '@/components/booking';
import { IconRefresh } from '@/components/icons';

type Customer = { mobile: string; name: string; bookings: Booking[]; active: number; paid: number; members: number; last: string };

const cols: Col<Customer>[] = [
  { key: 'name', label: 'Name', get: (c) => c.name },
  { key: 'mobile', label: 'Mobile', get: (c) => c.mobile },
  { key: 'bookings', label: 'Bookings', get: (c) => c.bookings.length },
  { key: 'active', label: 'Active bookings', get: (c) => c.active },
  { key: 'members', label: 'Members', get: (c) => c.members },
  { key: 'paid', label: 'Total paid (INR)', get: (c) => c.paid },
  { key: 'ids', label: 'Booking IDs', get: (c) => c.bookings.map((b) => b.bookingId).join(' ') },
];

export default function CustomersPage() {
  return <NeedFestival><Customers /></NeedFestival>;
}

function Customers() {
  const { items, loading, load, loadedAt } = useAllBookings();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const customers = useMemo(() => {
    const m = new Map<string, Customer>();
    for (const b of items) {
      const c = m.get(b.mobileNumber) ?? { mobile: b.mobileNumber, name: b.contactName, bookings: [], active: 0, paid: 0, members: 0, last: '' };
      c.bookings.push(b);
      if (b.bookingStatus !== 'cancelled') { c.active++; c.members += b.memberCount; }
      if (b.paymentStatus === 'paid') c.paid += b.amount;
      m.set(b.mobileNumber, c);
    }
    const needle = q.trim().toLowerCase();
    return [...m.values()]
      .filter((c) => !needle || c.name.toLowerCase().includes(needle) || c.mobile.includes(needle))
      .sort((a, b) => b.bookings.length - a.bookings.length || a.name.localeCompare(b.name));
  }, [items, q]);

  return (
    <>
      <PageHead title="Customers" sub={`${customers.length} devotees by mobile number`}
        actions={<><Btn onClick={() => load(true)} busy={loading}><IconRefresh size={16} /> Refresh</Btn><ExportButtons rows={customers} cols={cols} name="customers" /></>} />
      <Card>
        <div className="border-b border-gold/15 p-4"><Input placeholder="Search name or mobile…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-md" /></div>
        {loading && !items.length ? <div className="p-4"><Skeleton className="h-40" /></div> : customers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.9rem]">
              <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-4 py-3">Name</th><th className="px-3 py-3">Mobile</th><th className="px-3 py-3 text-right">Bookings</th><th className="px-3 py-3 text-right">Members</th><th className="px-3 py-3 text-right">Paid</th></tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <Fragment key={c.mobile}>
                    <tr className="cursor-pointer border-b border-gold/10 hover:bg-cream/70" onClick={() => setExpanded(expanded === c.mobile ? null : c.mobile)}>
                      <td className="px-4 py-3 font-semibold">{c.name}</td>
                      <td className="px-3 py-3 font-mono"><a href={`tel:+91${c.mobile}`} onClick={(e) => e.stopPropagation()} className="text-crimson">{c.mobile}</a></td>
                      <td className="px-3 py-3 text-right">{c.bookings.length}{c.active !== c.bookings.length && <span className="text-ink-mute"> ({c.active} active)</span>}</td>
                      <td className="px-3 py-3 text-right">{c.members}</td>
                      <td className="px-3 py-3 text-right font-semibold">{formatINR(c.paid)}</td>
                    </tr>
                    {expanded === c.mobile && (
                      <tr className="bg-cream/60"><td colSpan={5} className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">{c.bookings.map((b) => (
                          <button key={b.bookingId} onClick={() => setOpen(b.bookingId)} className="rounded-lg border border-gold/30 bg-white px-2.5 py-1 font-mono text-sm text-crimson hover:border-crimson">
                            {b.bookingId} · {b.bookingStatus}
                          </button>
                        ))}</div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ) : <Empty>No customers yet.</Empty>}
        {loadedAt && <div className="border-t border-gold/15 px-4 py-2 text-xs text-ink-mute">Loaded {loadedAt.toLocaleTimeString('en-IN')}</div>}
      </Card>
      <BookingModal bookingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
