'use client';
import { useEffect, useState } from 'react';
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { formatDateTime, type AdminSendNotificationInput, type NotificationRecord } from '@temple/shared';
import { callAdmin, getDb } from '@/lib/firebase';
import { PageHead } from '@/components/shell';
import { Badge, BiInput, Btn, Card, Empty, Field, Input, Select, useUi } from '@/components/ui';
import { BookingModal } from '@/components/booking';

export default function NotificationsPage() {
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<AdminSendNotificationInput>({ title: { ta: '', en: '' }, body: { ta: '', en: '' }, target: 'all', bookingId: '' });
  const [busy, setBusy] = useState(false);
  const [adminFeed, setAdminFeed] = useState<NotificationRecord[]>([]);
  const [sent, setSent] = useState<NotificationRecord[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    const col = collection(getDb(), 'notifications');
    const u1 = onSnapshot(query(col, where('audience', '==', 'admin'), orderBy('createdAt', 'desc'), limit(30)), (s) => setAdminFeed(s.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationRecord)));
    const u2 = onSnapshot(query(col, where('audience', 'in', ['all', 'user']), orderBy('createdAt', 'desc'), limit(30)), (s) => setSent(s.docs.map((d) => ({ id: d.id, ...d.data() }) as NotificationRecord)));
    return () => { u1(); u2(); };
  }, []);

  async function send() {
    if (!form.title.ta && !form.title.en) return toast('Title is required', 'err');
    if (form.target === 'booking' && !form.bookingId) return toast('Enter the booking ID', 'err');
    const ok = await confirm({ title: form.target === 'all' ? 'Send to ALL app users?' : `Send to booking ${form.bookingId}?`, body: 'Push notifications cannot be recalled.', confirm: 'Send' });
    if (!ok) return;
    setBusy(true);
    try {
      await callAdmin('adminSendNotification', { ...form, bookingId: form.target === 'booking' ? form.bookingId?.trim().toUpperCase() : undefined });
      toast('Notification sent');
      setForm({ title: { ta: '', en: '' }, body: { ta: '', en: '' }, target: 'all', bookingId: '' });
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  return (
    <>
      <PageHead title="Notifications" sub="Devotees using the mobile app receive these as push notifications, in their chosen language." />
      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Send a notification">
          <div className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Send to">
                <Select value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value as 'all' | 'booking' })}>
                  <option value="all">All app users (announcement)</option>
                  <option value="booking">One booking</option>
                </Select>
              </Field>
              {form.target === 'booking' && <Field label="Booking ID"><Input className="font-mono uppercase" value={form.bookingId} onChange={(e) => setForm({ ...form, bookingId: e.target.value })} /></Field>}
            </div>
            <BiInput label="Title" required value={form.title} onChange={(title) => setForm({ ...form, title })} />
            <BiInput label="Message" multiline value={form.body} onChange={(body) => setForm({ ...form, body })} />
            <Btn kind="primary" busy={busy} onClick={send}>Send notification</Btn>
            <p className="text-xs text-ink-mute">Booking confirmations, payment rejections and cancellations are sent automatically.</p>
          </div>
        </Card>
        <div className="space-y-6">
          <Card title="Admin alerts">
            {adminFeed.length ? (
              <ul className="divide-y divide-gold/15">{adminFeed.map((n) => (
                <li key={n.id} className="flex items-start justify-between gap-3 px-5 py-3">
                  <div><div className="font-semibold">{n.title.en}</div><div className="text-sm text-ink-soft">{n.body.en}</div></div>
                  <div className="text-right text-xs text-ink-mute">{formatDateTime(n.createdAt, 'en')}{n.bookingId && <button className="mt-1 block font-mono font-semibold text-crimson" onClick={() => setOpen(n.bookingId)}>{n.bookingId}</button>}</div>
                </li>
              ))}</ul>
            ) : <Empty>No alerts.</Empty>}
          </Card>
          <Card title="Sent to devotees">
            {sent.length ? (
              <ul className="divide-y divide-gold/15">{sent.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{n.title.ta || n.title.en}</span>
                    <Badge tone={n.audience === 'all' ? 'maroon' : 'blue'}>{n.audience === 'all' ? 'Everyone' : n.bookingId ?? 'User'}</Badge>
                  </div>
                  <div className="text-sm text-ink-soft">{n.body.ta || n.body.en}</div>
                  <div className="text-xs text-ink-mute">{formatDateTime(n.createdAt, 'en')} · {n.type === 'announcement' ? n.createdBy : 'automatic'}</div>
                </li>
              ))}</ul>
            ) : <Empty>Nothing sent yet.</Empty>}
          </Card>
        </div>
      </div>
      <BookingModal bookingId={open} onClose={() => setOpen(null)} />
    </>
  );
}
