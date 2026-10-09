'use client';
import { useState } from 'react';
import type { FestivalDay } from '@temple/shared';
import { useConfig } from '@/lib/context';
import { addDaysYmd, batch, doc, getDb, saveDoc } from '@/lib/write';
import { NeedFestival, PageHead } from '@/components/shell';
import { Badge, BiInput, Btn, Card, Empty, Field, Input, Modal, Toggle, useUi } from '@/components/ui';
import { fmtDate } from '@/components/booking';

type Form = Omit<FestivalDay, 'id' | 'festivalId'> & { id: string | null };
const ordinalTa = ['முதல்', 'இரண்டாம்', 'மூன்றாம்', 'நான்காம்', 'ஐந்தாம்', 'ஆறாம்', 'ஏழாம்', 'எட்டாம்', 'ஒன்பதாம்', 'பத்தாம்'];

export default function DaysPage() {
  return <NeedFestival><Days /></NeedFestival>;
}

function Days() {
  const { days, slots, festival, festivalId } = useConfig();
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  function blank(): Form {
    const n = (days[days.length - 1]?.dayNumber ?? 0) + 1;
    const date = days.length ? addDaysYmd(days[days.length - 1].date, 1) : festival?.startDate ?? '';
    return { id: null, dayNumber: n, date, dayName: { ta: `${ordinalTa[n - 1] ?? n + 'ஆம்'} நாள்`, en: `Day ${n}` }, title: { ta: '', en: '' }, description: { ta: '', en: '' }, active: true };
  }

  async function save() {
    if (!form) return;
    if (!form.date || form.dayNumber < 1) return toast('Day number and date are required', 'err');
    const original = days.find((d) => d.id === form.id);
    if (original && original.date !== form.date && slots.some((s) => s.dayId === original.id && s.bookedCount > 0)) {
      return toast('This day already has bookings, so its date cannot change. Cancel those bookings first or create a new day.', 'err');
    }
    setBusy(true);
    try {
      const { id, ...data } = form;
      const dayId = await saveDoc('festivalDays', id, { ...data, festivalId });
      // keep the denormalised date on this day's slots in sync
      const changed = slots.filter((s) => s.dayId === dayId && s.date !== form.date);
      if (changed.length) {
        const b = batch();
        changed.forEach((s) => b.update(doc(getDb(), 'timeSlots', s.id), { date: form.date }));
        await b.commit();
      }
      toast('Day saved');
      setForm(null);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  async function remove(d: FestivalDay) {
    const daySlots = slots.filter((s) => s.dayId === d.id);
    if (daySlots.some((s) => s.bookedCount > 0)) return toast('This day has bookings — deactivate it instead of deleting.', 'err');
    const ok = await confirm({ title: `Delete Day ${d.dayNumber}?`, body: `This also deletes its ${daySlots.length} empty time slot(s).`, confirm: 'Delete', danger: true });
    if (!ok) return;
    const b = batch();
    daySlots.forEach((s) => b.delete(doc(getDb(), 'timeSlots', s.id)));
    b.delete(doc(getDb(), 'festivalDays', d.id));
    try { await b.commit(); toast('Day deleted'); } catch (e) { toast((e as Error).message, 'err'); }
  }

  async function generate() {
    if (!festival) return;
    const count = Math.round((Date.parse(festival.endDate) - Date.parse(festival.startDate)) / 86400000) + 1;
    const ok = await confirm({ title: `Create ${count} days?`, body: `From ${fmtDate(festival.startDate)} to ${fmtDate(festival.endDate)}. You can then add titles and slots.`, confirm: 'Create days' });
    if (!ok) return;
    const b = batch();
    for (let i = 0; i < count; i++) {
      b.set(doc(getDb(), 'festivalDays', `${festivalId}-d${i + 1}`), {
        festivalId, dayNumber: i + 1, date: addDaysYmd(festival.startDate, i),
        dayName: { ta: `${ordinalTa[i] ?? i + 1 + 'ஆம்'} நாள்`, en: `Day ${i + 1}` }, title: { ta: '', en: '' }, description: { ta: '', en: '' }, active: true,
      });
    }
    try { await b.commit(); toast(`${count} days created`); } catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <>
      <PageHead title="Days" sub={festival?.name.en}
        actions={<>{!days.length && <Btn onClick={generate}>Generate from festival dates</Btn>}<Btn kind="primary" onClick={() => setForm(blank())}>+ Add day</Btn></>} />
      <Card>
        {days.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[0.92rem]">
              <thead className="border-b border-gold/20 text-[0.75rem] uppercase tracking-wide text-ink-mute">
                <tr><th className="px-4 py-3">Day</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Ubayam / Alankaram</th><th className="px-3 py-3 text-right">Slots</th><th className="px-3 py-3">Status</th><th className="px-3 py-3" /></tr>
              </thead>
              <tbody>
                {days.map((d) => {
                  const ds = slots.filter((s) => s.dayId === d.id);
                  return (
                    <tr key={d.id} className="border-b border-gold/10">
                      <td className="px-4 py-3"><div className="font-semibold">{d.dayName.en}</div><div className="text-sm text-ink-mute">{d.dayName.ta}</div></td>
                      <td className="whitespace-nowrap px-3 py-3">{fmtDate(d.date)}</td>
                      <td className="px-3 py-3"><div>{d.title.en || <span className="text-ink-mute">—</span>}</div><div className="text-sm text-ink-mute">{d.title.ta}</div></td>
                      <td className="px-3 py-3 text-right">{ds.length} · {ds.reduce((s, x) => s + x.bookedCount, 0)}/{ds.reduce((s, x) => s + x.capacity, 0)}</td>
                      <td className="px-3 py-3"><Badge tone={d.active ? 'green' : 'gray'}>{d.active ? 'Active' : 'Hidden'}</Badge></td>
                      <td className="px-3 py-3 text-right"><div className="flex justify-end gap-1">
                        <Btn kind="ghost" onClick={() => setForm({ ...d })}>Edit</Btn>
                        <Btn kind="ghost" className="!text-red-700" onClick={() => remove(d)}>Delete</Btn>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty>No days yet. Use “Generate from festival dates”.</Empty>}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit day' : 'Add day'} wide
        footer={<><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></>}>
        {form && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Day number"><Input type="number" min={1} value={form.dayNumber} onChange={(e) => setForm({ ...form, dayNumber: Number(e.target.value) })} /></Field>
              <Field label="Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
            </div>
            <BiInput label="Day name" value={form.dayName} onChange={(dayName) => setForm({ ...form, dayName })} />
            <BiInput label="Ubayam / alankaram name" value={form.title} onChange={(title) => setForm({ ...form, title })} />
            <BiInput label="Description" multiline value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Show to devotees" />
          </div>
        )}
      </Modal>
    </>
  );
}
