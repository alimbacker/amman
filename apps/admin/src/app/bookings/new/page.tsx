'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { formatINR, slotRemaining, type AdminCreateBookingInput, type CreateBookingResult, type GroupFamily, type PaymentMode } from '@temple/shared';
import { callAdmin } from '@/lib/firebase';
import { useConfig } from '@/lib/context';
import { NeedFestival, PageHead } from '@/components/shell';
import { Btn, Card, Field, Input, Select, Textarea, useUi } from '@/components/ui';
import { fmtDate, fmtTime } from '@/components/booking';

export default function NewBookingPage() {
  return <NeedFestival><NewBooking /></NeedFestival>;
}

function NewBooking() {
  const { days, slots, ubayams } = useConfig();
  const { toast } = useUi();
  const router = useRouter();
  const [dayId, setDayId] = useState('');
  const [slotId, setSlotId] = useState('');
  const [ubayamTypeId, setUb] = useState('');
  const [bookingType, setType] = useState<'family' | 'group'>('family');
  const [contactName, setName] = useState('');
  const [mobileNumber, setMobile] = useState('');
  const [familyName, setFamily] = useState('');
  const [memberCount, setCount] = useState(1);
  const [memberNames, setNames] = useState('');
  const [groupName, setGroup] = useState('');
  const [families, setFamilies] = useState<GroupFamily[]>([{ familyName: '', memberCount: 1 }, { familyName: '', memberCount: 1 }]);
  const [note, setNote] = useState('');
  const [paymentMode, setMode] = useState<PaymentMode>('cash');
  const [transactionId, setTxn] = useState('');
  const [busy, setBusy] = useState(false);

  const daySlots = slots.filter((s) => s.dayId === dayId);
  const dayUbayams = ubayams.filter((u) => u.active && (!u.dayIds?.length || u.dayIds.includes(dayId)));
  const ub = ubayams.find((u) => u.id === ubayamTypeId);
  const total = useMemo(() => families.reduce((s, f) => s + (Number(f.memberCount) || 0), 0), [families]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const input: AdminCreateBookingInput = {
      slotId, ubayamTypeId, bookingType, contactName, mobileNumber, note, paymentMode, transactionId: transactionId || undefined,
      ...(bookingType === 'family'
        ? { familyName, memberCount, memberNames: memberNames.split('\n').map((s) => s.trim()).filter(Boolean) }
        : { groupName, families }),
    };
    try {
      const r = await callAdmin<AdminCreateBookingInput, CreateBookingResult>('adminCreateBooking', input);
      toast(`Booking ${r.bookingId} created`);
      router.push(`/bookings?id=${r.bookingId}`);
    } catch (err) {
      toast((err as Error).message, 'err');
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead title="Manual booking" sub="For devotees booking at the temple counter or by phone. Admin bookings skip the online hold timer." />
      <form onSubmit={submit} className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="1 · Slot & ubayam">
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <Field label="Day">
                <Select required value={dayId} onChange={(e) => { setDayId(e.target.value); setSlotId(''); setUb(''); }}>
                  <option value="">Select…</option>
                  {days.map((d) => <option key={d.id} value={d.id}>Day {d.dayNumber} · {fmtDate(d.date)}{d.active ? '' : ' (inactive)'}</option>)}
                </Select>
              </Field>
              <Field label="Time slot">
                <Select required value={slotId} onChange={(e) => setSlotId(e.target.value)} disabled={!dayId}>
                  <option value="">Select…</option>
                  {daySlots.map((s) => <option key={s.id} value={s.id} disabled={slotRemaining(s) <= 0}>{fmtTime(s.time)} · {slotRemaining(s)} left{s.active ? '' : ' (inactive)'}</option>)}
                </Select>
              </Field>
              <Field label="Ubayam type">
                <Select required value={ubayamTypeId} onChange={(e) => setUb(e.target.value)} disabled={!dayId}>
                  <option value="">Select…</option>
                  {dayUbayams.map((u) => <option key={u.id} value={u.id}>{u.name.en} · {formatINR(u.price)}</option>)}
                </Select>
              </Field>
            </div>
          </Card>

          <Card title="2 · Devotee">
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <Field label="Booking type">
                <Select value={bookingType} onChange={(e) => setType(e.target.value as 'family' | 'group')}>
                  <option value="family" disabled={ub?.allowFamily === false}>Family</option>
                  <option value="group" disabled={ub?.allowGroup === false}>Group</option>
                </Select>
              </Field>
              <div />
              <Field label="Contact name"><Input required minLength={2} value={contactName} onChange={(e) => setName(e.target.value)} /></Field>
              <Field label="Mobile number"><Input required inputMode="numeric" pattern="[0-9 +]{10,14}" value={mobileNumber} onChange={(e) => setMobile(e.target.value)} /></Field>
              {bookingType === 'family' ? (
                <>
                  <Field label="Family name"><Input required minLength={2} value={familyName} onChange={(e) => setFamily(e.target.value)} /></Field>
                  <Field label="Members"><Input type="number" min={1} max={100} required value={memberCount} onChange={(e) => setCount(Number(e.target.value))} /></Field>
                  <Field label="Member names (one per line, optional)" className="md:col-span-2"><Textarea value={memberNames} onChange={(e) => setNames(e.target.value)} /></Field>
                </>
              ) : (
                <>
                  <Field label="Group name" className="md:col-span-2"><Input required minLength={2} value={groupName} onChange={(e) => setGroup(e.target.value)} /></Field>
                  <div className="space-y-2 md:col-span-2">
                    {families.map((f, i) => (
                      <div key={i} className="grid grid-cols-[1fr_6rem_auto] items-center gap-2">
                        <Input required placeholder={`Family ${i + 1} name`} value={f.familyName} onChange={(e) => setFamilies(families.map((x, j) => (j === i ? { ...x, familyName: e.target.value } : x)))} />
                        <Input type="number" min={1} required value={f.memberCount} onChange={(e) => setFamilies(families.map((x, j) => (j === i ? { ...x, memberCount: Number(e.target.value) } : x)))} />
                        <Btn type="button" kind="ghost" disabled={families.length <= 2} onClick={() => setFamilies(families.filter((_, j) => j !== i))}>✕</Btn>
                      </div>
                    ))}
                    <div className="flex items-center justify-between">
                      <Btn type="button" onClick={() => setFamilies([...families, { familyName: '', memberCount: 1 }])}>+ Add family</Btn>
                      <span className="font-semibold text-maroon">Total members: {total}</span>
                    </div>
                  </div>
                </>
              )}
              <Field label="Special prayer note (optional)" className="md:col-span-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
            </div>
          </Card>
        </div>

        <div>
          <Card title="3 · Payment" className="xl:sticky xl:top-6">
            <div className="space-y-4 p-5">
              <div className="rounded-xl bg-gold-pale/60 p-4">
                <div className="text-sm text-ink-soft">Amount</div>
                <div className="font-display text-3xl font-bold text-maroon">{ub ? formatINR(ub.price) : '—'}</div>
              </div>
              <Field label="Payment">
                <Select value={paymentMode} onChange={(e) => setMode(e.target.value as PaymentMode)}>
                  <option value="cash">Cash received — confirm now</option>
                  <option value="upi">UPI received (enter UTR) — confirm now</option>
                  <option value="later">Not paid yet — keep pending</option>
                </Select>
              </Field>
              {paymentMode === 'upi' && <Field label="UTR / transaction ID"><Input required value={transactionId} onChange={(e) => setTxn(e.target.value)} className="font-mono" /></Field>}
              <Btn type="submit" kind="primary" className="w-full min-h-[2.9rem]" busy={busy}>Create booking</Btn>
            </div>
          </Card>
        </div>
      </form>
    </>
  );
}
