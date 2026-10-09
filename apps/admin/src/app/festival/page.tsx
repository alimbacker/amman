'use client';
import { useState } from 'react';
import type { Bilingual, Festival } from '@temple/shared';
import { useConfig } from '@/lib/context';
import { saveDoc } from '@/lib/write';
import { PageHead } from '@/components/shell';
import { Badge, BiInput, Btn, Card, Empty, Field, Input, Modal, Toggle, useUi } from '@/components/ui';
import { fmtDate } from '@/components/booking';

type Form = Omit<Festival, 'id'> & { id: string | null };
const blank: Form = { id: null, name: { ta: '', en: '' }, description: { ta: '', en: '' }, startDate: '', endDate: '', active: true };

export default function FestivalPage() {
  const { festivals, festivalId, settings } = useConfig();
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    if (!form.name.ta && !form.name.en) return toast('Name is required', 'err');
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return toast('Check the start and end dates', 'err');
    setBusy(true);
    try {
      const { id, ...data } = form;
      const newId = await saveDoc('festivals', id, data);
      if (!settings?.currentFestivalId) await saveDoc('settings', 'public', { currentFestivalId: newId });
      toast('Festival saved');
      setForm(null);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  async function makeCurrent(f: Festival) {
    const ok = await confirm({ title: `Make “${f.name.en}” the current festival?`, body: 'The website, app and dashboard will show this festival’s days, slots and bookings.', confirm: 'Make current' });
    if (!ok) return;
    try { await saveDoc('settings', 'public', { currentFestivalId: f.id }); toast('Current festival changed'); } catch (e) { toast((e as Error).message, 'err'); }
  }

  return (
    <>
      <PageHead title="Festival" sub="Create a festival, then add its days, slots and ubayam types." actions={<Btn kind="primary" onClick={() => setForm({ ...blank })}>+ New festival</Btn>} />
      <Card>
        {festivals.length ? (
          <ul className="divide-y divide-gold/15">
            {festivals.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display text-lg font-bold text-maroon">{f.name.en}</span>
                    {f.id === festivalId && <Badge tone="maroon">Current</Badge>}
                    <Badge tone={f.active ? 'green' : 'gray'}>{f.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                  <div className="text-ink-soft">{f.name.ta}</div>
                  <div className="text-sm text-ink-mute">{fmtDate(f.startDate)} – {fmtDate(f.endDate)} {f.startDate.slice(0, 4)}</div>
                </div>
                <div className="flex gap-2">
                  {f.id !== festivalId && <Btn onClick={() => makeCurrent(f)}>Make current</Btn>}
                  <Btn kind="ghost" onClick={() => setForm({ ...f })}>Edit</Btn>
                </div>
              </li>
            ))}
          </ul>
        ) : <Empty>No festivals yet. Create one, or run the seed script for sample data.</Empty>}
      </Card>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit festival' : 'New festival'} wide
        footer={<><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></>}>
        {form && (
          <div className="space-y-4">
            <BiInput label="Name" required value={form.name} onChange={(name: Bilingual) => setForm({ ...form, name })} />
            <BiInput label="Description (Navaratri information on the home page)" multiline value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start date"><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></Field>
              <Field label="End date"><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></Field>
            </div>
            <Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Active (bookable)" />
          </div>
        )}
      </Modal>
    </>
  );
}
