'use client';
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { formatDateTime, formatINR, tsToDate, type Booking, type PaymentRecord } from '@temple/shared';
import { getDb } from '@/lib/firebase';
import { useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Badge, Card, Empty, ExportButtons, Skeleton, type Col } from '@/components/ui';
import { ActionButtons, BookingModal, fmtDate, fmtTime, who } from '@/components/booking';

type Tab = 'verify' | 'awaiting' | 'paid' | 'rejected';
type Pay = PaymentRecord & { amountMismatch?: boolean };

const payCols: Col<Pay>[] = [
  { key: 'booking', label: 'Booking ID', get: (p) => p.bookingId },
  { key: 'name', label: 'Name', get: (p) => p.contactName },
  { key: 'mobile', label: 'Mobile', get: (p) => p.mobileNumber },
  { key: 'utr', label: 'UTR / Txn ID', get: (p) => p.transactionId },
  { key: 'mode', label: 'Mode', get: (p) => p.mode },
  { key: 'entered', label: 'Amount entered', get: (p) => p.amountEntered },
  { key: 'expected', label: 'Expected', get: (p) => p.expectedAmount },
  { key: 'status', label: 'Status', get: (p) => p.status },
  { key: 'submitted', label: 'Submitted', get: (p) => tsToDate(p.submittedAt)?.toISOString() ?? '' },
  { key: 'verified', label: 'Verified', get: (p) => tsToDate(p.verifiedAt)?.toISOString() ?? '' },
  { key: 'by', label: 'Verified by', get: (p) => p.verifiedBy ?? '' },
  { key: 'reason', label: 'Reason', get: (p) => p.reason ?? '' },
];

export default function PaymentsPage() {
  return <NeedFestival><Payments /></NeedFestival>;
}

function Payments() {
  const { festivalId } = useConfig();
  const [tab, setTab] = useState<Tab>('verify');
  const [pending, setPending] = useState<Booking[] | null>(null);
  const [history, setHistory] = useState<Pay[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  // Live queue of bookings whose payment is still pending (both "submitted" and "not yet paid").
  useEffect(() => {
    const q = query(collection(getDb(), 'bookings'), where('festivalId', '==', festivalId), where('paymentStatus', '==', 'pending'), where('bookingStatus', '==', 'pending'), orderBy('createdAt', 'desc'), limit(300));
    return onSnapshot(q, (s) => setPending(s.docs.map((d) => d.data() as Booking)));
  }, [festivalId]);

  useEffect(() => {
    if (tab !== 'paid' && tab !== 'rejected') return;
    setHistory(null);
    const q = query(collection(getDb(), 'payments'), where('festivalId', '==', festivalId), where('status', '==', tab), orderBy('submittedAt', 'desc'), limit(300));
    return onSnapshot(q, (s) => setHistory(s.docs.map((d) => ({ id: d.id, ...d.data() }) as Pay)));
  }, [festivalId, tab]);

  const verify = (pending ?? []).filter((b) => b.paymentSubmitted).sort((a, b) => (tsToDate(a.paymentSubmittedAt)?.getTime() ?? 0) - (tsToDate(b.paymentSubmittedAt)?.getTime() ?? 0));
  const awaiting = (pending ?? []).filter((b) => !b.paymentSubmitted);

  const tabs: { k: Tab; label: string; n?: number }[] = [
    { k: 'verify', label: 'To verify', n: verify.length },
    { k: 'awaiting', label: 'Awaiting payment', n: awaiting.length },
    { k: 'paid', label: 'Paid' },
    { k: 'rejected', label: 'Rejected' },
  ];

  return (
    <>
      <PageHead title="Payments" sub="Check each UTR in the temple’s bank / UPI app before approving." actions={history && (tab === 'paid' || tab === 'rejected') ? <ExportButtons rows={history} cols={payCols} name={`payments-${tab}`} /> : undefined} />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`rounded-full px-4 py-2 text-sm font-semibold transition ${tab === t.k ? 'bg-crimson text-white shadow' : 'bg-white text-ink-soft ring-1 ring-gold/30 hover:ring-gold'}`}>
            {t.label}{t.n !== undefined && <span className={`ml-1.5 rounded-full px-1.5 ${tab === t.k ? 'bg-white/25' : 'bg-gold-pale'}`}>{t.n}</span>}
          </button>
        ))}
      </div>

      {(tab === 'verify' || tab === 'awaiting') && (
        <Card>
          {pending === null ? <div className="p-4"><Skeleton className="h-40" /></div> : (tab === 'verify' ? verify : awaiting).length === 0 ? <Empty>{tab === 'verify' ? 'Nothing to verify. 🙏' : 'No unpaid holds.'}</Empty> : (
            <ul className="divide-y divide-gold/15">
              {(tab === 'verify' ? verify : awaiting).map((b) => {
                const mismatch = b.amountPaid != null && Math.round(b.amountPaid) !== Math.round(b.amount);
                return (
                  <li key={b.bookingId} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                    <button className="text-left" onClick={() => setOpen(b.bookingId)}>
                      <div className="font-mono font-semibold text-crimson">{b.bookingId}</div>
                      <div className="font-semibold">{who(b)} <span className="font-normal text-ink-mute">· {b.contactName}</span></div>
                      <div className="text-sm text-ink-mute">{b.mobileNumber} · D{b.dayNumber} {fmtDate(b.date)} {fmtTime(b.time)}</div>
                    </button>
                    {tab === 'verify' ? (
                      <div>
                        <div className="text-xs uppercase tracking-wide text-ink-mute">UTR / Txn ID</div>
                        <div className="font-mono text-[1.05rem] font-bold tracking-wider">{b.transactionId}</div>
                        <div className="text-xs text-ink-mute">{formatDateTime(b.paymentSubmittedAt, 'en')}</div>
                      </div>
                    ) : (
                      <div className="text-sm text-ink-soft">Hold until<br /><b>{formatDateTime(b.holdExpiresAt, 'en')}</b>{b.paymentStatus === 'pending' && b.rejectionReason && <div><Badge tone="red">rejected before</Badge></div>}</div>
                    )}
                    <div>
                      <div className="text-xs uppercase tracking-wide text-ink-mute">Amount</div>
                      <div className="font-semibold">{tab === 'verify' ? formatINR(b.amountPaid ?? 0) : formatINR(b.amount)} {mismatch && <Badge tone="red">expected {formatINR(b.amount)}</Badge>}</div>
                    </div>
                    <ActionButtons b={b} />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {(tab === 'paid' || tab === 'rejected') && (
        <Card>
          {history === null ? <div className="p-4"><Skeleton className="h-40" /></div> : history.length === 0 ? <Empty>No records.</Empty> : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[0.9rem]">
                <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
                  <tr><th className="px-4 py-3">Booking</th><th className="px-3 py-3">Devotee</th><th className="px-3 py-3">UTR</th><th className="px-3 py-3">Mode</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Verified</th>{tab === 'rejected' && <th className="px-3 py-3">Reason</th>}</tr>
                </thead>
                <tbody>{history.map((p) => (
                  <tr key={p.id} onClick={() => setOpen(p.bookingId)} className="cursor-pointer border-b border-gold/10 hover:bg-cream/70">
                    <td className="px-4 py-3 font-mono font-semibold text-crimson">{p.bookingId}</td>
                    <td className="px-3 py-3">{p.contactName}<div className="font-mono text-xs text-ink-mute">{p.mobileNumber}</div></td>
                    <td className="px-3 py-3 font-mono">{p.transactionId}</td>
                    <td className="px-3 py-3">{p.mode}</td>
                    <td className="px-3 py-3 text-right">{formatINR(p.amountEntered)} {p.amountMismatch && <Badge tone="red">≠ {formatINR(p.expectedAmount)}</Badge>}</td>
                    <td className="px-3 py-3 text-sm">{formatDateTime(p.verifiedAt, 'en')}<div className="text-xs text-ink-mute">{p.verifiedBy}</div></td>
                    {tab === 'rejected' && <td className="px-3 py-3 text-sm">{p.reason}</td>}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <BookingModal bookingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
