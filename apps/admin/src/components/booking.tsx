'use client';
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { formatDate, formatDateTime, formatINR, formatTime, type Booking } from '@temple/shared';
import { callAdmin, getDb } from '@/lib/firebase';
import { useAllBookings } from '@/lib/context';
import { Badge, Btn, Modal, PayBadge, StatusBadge, useUi } from './ui';

export const fmtDate = (ymd: string) => formatDate(ymd, 'en', { weekday: true, year: false });
export const fmtTime = (t: string) => formatTime(t, 'en');
export const who = (b: Booking) => (b.bookingType === 'family' ? b.familyName : b.groupName) ?? '';

/** Approve / reject / cancel with the right confirmations. Returns true when something changed. */
export function useBookingActions() {
  const { toast, confirm } = useUi();
  const all = useAllBookings(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    try { await fn(); toast(ok); all.load(true).catch(() => {}); return true; }
    catch (e) { toast((e as Error).message, 'err'); return false; }
    finally { setBusy(null); }
  }

  return {
    busy,
    approve: async (b: Booking) => {
      const mismatch = b.amountPaid != null && Math.round(b.amountPaid) !== Math.round(b.amount);
      const ok = await confirm({
        title: `Approve payment ${b.bookingId}?`,
        body: `Confirm that ${formatINR(b.amountPaid ?? b.amount)} with UTR ${b.transactionId ?? '—'} is in the temple account.${mismatch ? ` ⚠ Expected ${formatINR(b.amount)}.` : ''} The booking becomes Confirmed.`,
        confirm: 'Approve & confirm',
      });
      return ok ? run(`a${b.bookingId}`, () => callAdmin('adminVerifyPayment', { bookingId: b.bookingId, action: 'approve' }), `${b.bookingId} confirmed`) : false;
    },
    reject: async (b: Booking) => {
      const reason = await confirm({ title: `Reject payment ${b.bookingId}?`, body: 'The devotee is notified and can resubmit a correct transaction ID within 12 hours (3 attempts in total; after the last one the booking is cancelled and the place released).', confirm: 'Reject payment', danger: true, input: 'Reason (shown to devotee)' });
      return reason ? run(`r${b.bookingId}`, () => callAdmin('adminVerifyPayment', { bookingId: b.bookingId, action: 'reject', reason }), `${b.bookingId} payment rejected`) : false;
    },
    cash: async (b: Booking) => {
      const ok = await confirm({ title: `Mark ${b.bookingId} as paid in cash?`, body: `Confirm ${formatINR(b.amount)} was received at the temple counter. The booking becomes Confirmed.`, confirm: 'Cash received' });
      return ok ? run(`m${b.bookingId}`, () => callAdmin('adminVerifyPayment', { bookingId: b.bookingId, action: 'cash' }), `${b.bookingId} confirmed (cash)`) : false;
    },
    cancel: async (b: Booking) => {
      const reason = await confirm({
        title: `Cancel booking ${b.bookingId}?`,
        body: b.paymentStatus === 'paid' ? 'This booking is PAID — arrange the refund manually. The place is released to the slot.' : 'The place is released back to the slot.',
        confirm: 'Cancel booking', danger: true, input: 'Reason',
      });
      return reason ? run(`c${b.bookingId}`, () => callAdmin('adminCancelBooking', { bookingId: b.bookingId, reason }), `${b.bookingId} cancelled`) : false;
    },
  };
}

export function ActionButtons({ b, compact }: { b: Booking; compact?: boolean }) {
  const a = useBookingActions();
  const canVerify = b.bookingStatus === 'pending' && b.paymentSubmitted && b.paymentStatus === 'pending';
  const canApproveAfterReject = b.bookingStatus === 'pending' && b.paymentStatus === 'rejected' && !!b.transactionId;
  const canCancel = b.bookingStatus === 'pending' || b.bookingStatus === 'confirmed';
  const sz = compact ? 'min-h-[2.1rem] px-3 text-[0.82rem]' : '';
  return (
    <div className="flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
      {(canVerify || canApproveAfterReject) && <Btn kind="success" className={sz} busy={a.busy === `a${b.bookingId}`} onClick={() => a.approve(b)}>Approve</Btn>}
      {canVerify && <Btn kind="outline" className={`${sz} !text-red-700`} busy={a.busy === `r${b.bookingId}`} onClick={() => a.reject(b)}>Reject</Btn>}
      {b.bookingStatus === 'pending' && b.paymentStatus !== 'paid' && !compact && <Btn kind="outline" busy={a.busy === `m${b.bookingId}`} onClick={() => a.cash(b)}>Cash received</Btn>}
      {canCancel && !compact && <Btn kind="ghost" className={`${sz} !text-red-700`} busy={a.busy === `c${b.bookingId}`} onClick={() => a.cancel(b)}>Cancel booking</Btn>}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[9rem_1fr] gap-3 border-b border-dashed border-gold/20 py-2 text-[0.93rem] last:border-0">
      <dt className="text-ink-mute">{k}</dt><dd className="font-medium text-ink">{v}</dd>
    </div>
  );
}

/** Live booking detail modal with actions. */
export function BookingModal({ bookingId, onClose }: { bookingId: string | null; onClose: () => void }) {
  const [b, setB] = useState<(Booking & Record<string, unknown>) | null>(null);
  useEffect(() => {
    if (!bookingId) { setB(null); return; }
    return onSnapshot(doc(getDb(), 'bookings', bookingId), (s) => setB((s.data() as Booking & Record<string, unknown>) ?? null));
  }, [bookingId]);

  return (
    <Modal open={!!bookingId} onClose={onClose} title={bookingId ? `Booking ${bookingId}` : ''} wide footer={b ? <ActionButtons b={b} /> : undefined}>
      {!b ? <div className="h-40 animate-pulse rounded-xl bg-gold-pale/50" /> : (
        <div className="grid gap-6 md:grid-cols-2">
          <dl>
            <Row k="Status" v={<div className="flex gap-2"><StatusBadge s={b.bookingStatus} /><PayBadge b={b} /></div>} />
            <Row k="Type" v={b.bookingType === 'family' ? 'Family' : 'Group'} />
            <Row k={b.bookingType === 'family' ? 'Family' : 'Group'} v={who(b)} />
            <Row k="Contact" v={b.contactName} />
            <Row k="Mobile" v={<a className="text-crimson underline" href={`tel:+91${b.mobileNumber}`}>{b.mobileNumber}</a>} />
            <Row k="Members" v={b.memberCount} />
            {b.bookingType === 'family' && b.memberNames?.length > 0 && <Row k="Member names" v={b.memberNames.join(', ')} />}
            {b.bookingType === 'group' && <Row k="Families" v={<ul>{b.families.map((f, i) => <li key={i}>{f.familyName} – {f.memberCount}</li>)}</ul>} />}
            {b.note && <Row k="Prayer note" v={b.note} />}
          </dl>
          <dl>
            <Row k="Ubayam" v={<>{b.ubayamType.en}<div className="text-sm text-ink-mute">{b.ubayamType.ta}</div></>} />
            <Row k="Day / date" v={`Day ${b.dayNumber} · ${fmtDate(b.date)}`} />
            <Row k="Time" v={fmtTime(b.time)} />
            <Row k="Amount" v={formatINR(b.amount)} />
            <Row k="Paid (entered)" v={b.amountPaid != null ? (
              <span>{formatINR(b.amountPaid)} {Math.round(b.amountPaid) !== Math.round(b.amount) && <Badge tone="red">Mismatch</Badge>}</span>
            ) : '—'} />
            <Row k="UTR / Txn ID" v={<span className="font-mono">{b.transactionId ?? '—'}</span>} />
            <Row k="Payment mode" v={b.paymentMode} />
            {b.rejectionReason && <Row k="Rejected because" v={b.rejectionReason} />}
            {b.cancelReason && <Row k="Cancelled because" v={b.cancelReason} />}
            {Boolean(b.refundDue) && <Row k="Refund" v={<Badge tone="red">Refund due</Badge>} />}
            <Row k="Source" v={b.source} />
            <Row k="Created" v={formatDateTime(b.createdAt, 'en')} />
            {Boolean(b.verifiedBy) && <Row k="Verified by" v={String(b.verifiedBy)} />}
          </dl>
        </div>
      )}
    </Modal>
  );
}

/** Responsive list: table on desktop, cards on phones. */
export function BookingList({ items, onOpen, showActions = true }: { items: Booking[]; onOpen: (id: string) => void; showActions?: boolean }) {
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-left text-[0.9rem]">
          <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
            <tr>
              <th className="px-4 py-3">Booking</th><th className="px-3 py-3">Family / Group</th><th className="px-3 py-3">Mobile</th>
              <th className="px-3 py-3">Day · Time</th><th className="px-3 py-3">Ubayam</th><th className="px-3 py-3 text-right">Mem.</th>
              <th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Status</th>{showActions && <th className="px-3 py-3" />}
            </tr>
          </thead>
          <tbody>
            {items.map((b) => (
              <tr key={b.bookingId} onClick={() => onOpen(b.bookingId)} className="cursor-pointer border-b border-gold/10 hover:bg-cream/70">
                <td className="px-4 py-3"><div className="font-mono font-semibold text-crimson">{b.bookingId}</div><div className="text-xs text-ink-mute">{formatDateTime(b.createdAt, 'en')}</div></td>
                <td className="px-3 py-3"><div className="font-semibold">{who(b)}</div><div className="text-xs text-ink-mute">{b.contactName} · {b.bookingType}</div></td>
                <td className="px-3 py-3 font-mono">{b.mobileNumber}</td>
                <td className="px-3 py-3 whitespace-nowrap">D{b.dayNumber} · {fmtDate(b.date)}<div className="text-xs text-ink-mute">{fmtTime(b.time)}</div></td>
                <td className="px-3 py-3">{b.ubayamType.en}</td>
                <td className="px-3 py-3 text-right">{b.memberCount}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatINR(b.amount)}</td>
                <td className="px-3 py-3"><div className="flex flex-col items-start gap-1"><StatusBadge s={b.bookingStatus} /><PayBadge b={b} /></div></td>
                {showActions && <td className="px-3 py-3"><ActionButtons b={b} compact /></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="divide-y divide-gold/15 md:hidden">
        {items.map((b) => (
          <li key={b.bookingId} onClick={() => onOpen(b.bookingId)} className="cursor-pointer px-4 py-3 active:bg-cream">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-sm font-semibold text-crimson">{b.bookingId}</div>
                <div className="font-semibold">{who(b)}</div>
                <div className="text-sm text-ink-mute">{b.mobileNumber} · D{b.dayNumber} {fmtTime(b.time)} · {b.memberCount} mem.</div>
              </div>
              <div className="text-right font-semibold">{formatINR(b.amount)}</div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><StatusBadge s={b.bookingStatus} /><PayBadge b={b} />{showActions && <ActionButtons b={b} compact />}</div>
          </li>
        ))}
      </ul>
    </>
  );
}
