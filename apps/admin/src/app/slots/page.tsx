'use client';
import { useState } from 'react';
import { slotRemaining, slotState, type Bilingual, type TimeSlot } from '@temple/shared';
import { useConfig } from '@/lib/context';
import { batch, doc, getDb, patchDoc, removeDoc } from '@/lib/write';
import { NeedFestival, PageHead } from '@/components/shell';
import { Badge, BiInput, Btn, Card, Empty, Field, Input, Modal, Toggle, useUi } from '@/components/ui';
import { fmtDate, fmtTime } from '@/components/booking';

type Form = { id: string | null; dayIds: string[]; time: string; capacity: number; label: Bilingual; active: boolean; bookedCount: number };

export default function SlotsPage() {
  return <NeedFestival><Slots /></NeedFestival>;
}

function Slots() {
  const { days, slots, festivalId, settings } = useConfig();
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    if (!/^\d{2}:\d{2}$/.test(form.time)) return toast('Enter a valid time', 'err');
    if (!Number.isInteger(form.capacity) || form.capacity < 1) return toast('Capacity must be a whole number ≥ 1', 'err');
    if (form.id && form.capacity < form.bookedCount) return toast(`Capacity cannot be below the ${form.bookedCount} places already booked`, 'err');
    if (!form.id && !form.dayIds.length) return toast('Choose at least one day', 'err');
    setBusy(true);
    try {
      if (form.id) {
        await patchDoc(`timeSlots/${form.id}`, { time: form.time, capacity: form.capacity, label: form.label, active: form.active });
      } else {
        const b = batch();
        let skipped = 0;
        for (const dayId of form.dayIds) {
          if (slots.some((s) => s.dayId === dayId && s.time === form.time)) { skipped++; continue; }
          const day = days.find((d) => d.id === dayId)!;
          b.set(doc(getDb(), 'timeSlots', `${dayId}-${form.time.replace(':', '')}`), {
            festivalId, dayId, date: day.date, time: form.time, capacity: form.capacity, bookedCount: 0, label: form.label, active: form.active,
          });
        }
        await b.commit();
        if (skipped) toast(`${skipped} day(s) already had a ${fmtTime(form.time)} slot and were skipped`);
      }
      toast('Slot saved');
      setForm(null);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  async function remove(s: TimeSlot) {
    if (s.bookedCount > 0) return toast('This slot has bookings — make it inactive instead.', 'err');
    if (!(await confirm({ title: `Delete ${fmtTime(s.time)} slot?`, confirm: 'Delete', danger: true }))) return;
    try { await removeDoc(`timeSlots/${s.id}`); toast('Slot deleted'); } catch (e) { toast((e as Error).message, 'err'); }
  }

  async function toggle(s: TimeSlot) {
    try { await patchDoc(`timeSlots/${s.id}`, { active: !s.active }); } catch (e) { toast((e as Error).message, 'err'); }
  }

  const newForm = (dayIds: string[] = []): Form => ({ id: null, dayIds, time: '06:00', capacity: 20, label: { ta: '', en: '' }, active: true, bookedCount: 0 });

  return (
    <>
      <PageHead title="Time Slots" sub={`Capacity counts ${settings?.capacityMode === 'members' ? 'members' : 'bookings'} (change in Settings → Booking rules).`}
        actions={<Btn kind="primary" disabled={!days.length} onClick={() => setForm(newForm(days.map((d) => d.id)))}>+ Add slot</Btn>} />
      {!days.length && <Card><Empty>Add festival days first.</Empty></Card>}
      <div className="grid gap-5 xl:grid-cols-2">
        {days.map((d) => {
          const ds = slots.filter((s) => s.dayId === d.id);
          return (
            <Card key={d.id} title={<>Day {d.dayNumber} · {fmtDate(d.date)} {!d.active && <Badge tone="gray">day hidden</Badge>}</>}
              actions={<Btn kind="ghost" className="min-h-[2rem] text-sm" onClick={() => setForm(newForm([d.id]))}>+ Slot</Btn>}>
              {ds.length ? (
                <table className="w-full text-[0.9rem]">
                  <thead className="text-left text-[0.72rem] uppercase tracking-wide text-ink-mute">
                    <tr><th className="px-5 py-2">Time</th><th className="px-2 py-2 text-right">Cap.</th><th className="px-2 py-2 text-right">Booked</th><th className="px-2 py-2 text-right">Left</th><th className="px-2 py-2">Status</th><th className="px-2 py-2" /></tr>
                  </thead>
                  <tbody>
                    {ds.map((s) => {
                      const st = slotState(s, settings?.limitedThresholdPct);
                      return (
                        <tr key={s.id} className="border-t border-gold/10">
                          <td className="px-5 py-2.5"><div className="font-semibold">{fmtTime(s.time)}</div><div className="text-xs text-ink-mute">{s.label?.en}</div></td>
                          <td className="px-2 py-2.5 text-right">{s.capacity}</td>
                          <td className="px-2 py-2.5 text-right">{s.bookedCount}</td>
                          <td className="px-2 py-2.5 text-right font-semibold">{slotRemaining(s)}</td>
                          <td className="px-2 py-2.5"><Badge tone={st === 'available' ? 'green' : st === 'limited' ? 'amber' : st === 'full' ? 'red' : 'gray'}>{st === 'available' ? '🟢 Available' : st === 'limited' ? '🟡 Limited' : st === 'full' ? '🔴 Full' : 'Inactive'}</Badge></td>
                          <td className="px-2 py-2.5"><div className="flex items-center justify-end gap-1">
                            <Toggle checked={s.active} onChange={() => toggle(s)} />
                            <Btn kind="ghost" className="min-h-[2rem] px-2 text-sm" onClick={() => setForm({ id: s.id, dayIds: [s.dayId], time: s.time, capacity: s.capacity, label: s.label ?? { ta: '', en: '' }, active: s.active, bookedCount: s.bookedCount })}>Edit</Btn>
                            <Btn kind="ghost" className="min-h-[2rem] px-2 text-sm !text-red-700" disabled={s.bookedCount > 0} onClick={() => remove(s)}>Delete</Btn>
                          </div></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <Empty>No slots for this day.</Empty>}
            </Card>
          );
        })}
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit slot' : 'Add slot'}
        footer={<><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></>}>
        {form && (
          <div className="space-y-4">
            {!form.id && (
              <Field label="Days">
                <div className="flex flex-wrap gap-2">
                  {days.map((d) => {
                    const on = form.dayIds.includes(d.id);
                    return (
                      <button type="button" key={d.id} onClick={() => setForm({ ...form, dayIds: on ? form.dayIds.filter((x) => x !== d.id) : [...form.dayIds, d.id] })}
                        className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${on ? 'border-crimson bg-maroon-50 text-crimson' : 'border-gold/30 text-ink-soft'}`}>Day {d.dayNumber}</button>
                    );
                  })}
                </div>
              </Field>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Time (temple local)" hint={form.bookedCount > 0 ? 'Locked: slot has bookings' : undefined}><Input type="time" disabled={form.bookedCount > 0} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /></Field>
              <Field label="Capacity" hint={form.id ? `${form.bookedCount} already booked` : undefined}>
                <Input type="number" min={Math.max(1, form.bookedCount)} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: Math.floor(Number(e.target.value)) })} />
              </Field>
            </div>
            <BiInput label="Label (optional)" value={form.label} onChange={(label) => setForm({ ...form, label })} />
            <Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Open for booking" />
          </div>
        )}
      </Modal>
    </>
  );
}
