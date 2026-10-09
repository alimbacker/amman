'use client';
import { useState } from 'react';
import { formatINR, type UbayamType } from '@temple/shared';
import { useConfig } from '@/lib/context';
import { removeDoc, saveDoc } from '@/lib/write';
import { NeedFestival, PageHead } from '@/components/shell';
import { Badge, BiInput, Btn, Card, Empty, Field, Input, Modal, Toggle, useUi } from '@/components/ui';

type Form = Omit<UbayamType, 'id' | 'festivalId'> & { id: string | null };

export default function UbayamTypesPage() {
  return <NeedFestival><UbayamTypes /></NeedFestival>;
}

function UbayamTypes() {
  const { ubayams, days, festivalId } = useConfig();
  const { toast, confirm } = useUi();
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    if (!form.name.ta && !form.name.en) return toast('Name is required', 'err');
    if (!(form.price >= 0)) return toast('Enter a valid price', 'err');
    if (!form.allowFamily && !form.allowGroup) return toast('Allow family, group, or both', 'err');
    setBusy(true);
    try {
      const { id, ...data } = form;
      await saveDoc('ubayamTypes', id, { ...data, festivalId, price: Math.round(form.price) });
      toast('Ubayam type saved');
      setForm(null);
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  async function remove(u: UbayamType) {
    const ok = await confirm({ title: `Delete “${u.name.en}”?`, body: 'Existing bookings keep their ubayam name and price. To stop new bookings only, make it inactive instead.', confirm: 'Delete', danger: true });
    if (!ok) return;
    try { await removeDoc(`ubayamTypes/${u.id}`); toast('Deleted'); } catch (e) { toast((e as Error).message, 'err'); }
  }

  const blank: Form = { id: null, name: { ta: '', en: '' }, description: { ta: '', en: '' }, price: 501, dayIds: [], allowFamily: true, allowGroup: true, active: true, sortOrder: ubayams.length + 1 };

  return (
    <>
      <PageHead title="Ubayam Types" sub="Name, description and price shown to devotees. Prices apply to new bookings only." actions={<Btn kind="primary" onClick={() => setForm({ ...blank })}>+ Add ubayam type</Btn>} />
      {ubayams.length ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {ubayams.map((u) => (
            <Card key={u.id} className="flex flex-col">
              <div className="flex-1 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-display text-lg font-bold text-maroon">{u.name.ta}</div>
                    <div className="text-ink-soft">{u.name.en}</div>
                  </div>
                  <div className="rounded-xl bg-gold-pale px-3 py-1 text-lg font-bold text-maroon-900">{formatINR(u.price)}</div>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{u.description.en}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Badge tone={u.active ? 'green' : 'gray'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                  {u.allowFamily && <Badge tone="maroon">Family</Badge>}
                  {u.allowGroup && <Badge tone="maroon">Group</Badge>}
                  <Badge tone="blue">{u.dayIds?.length ? `Days ${u.dayIds.map((id) => days.find((d) => d.id === id)?.dayNumber ?? '?').join(', ')}` : 'All days'}</Badge>
                </div>
              </div>
              <div className="flex justify-end gap-1 border-t border-gold/15 px-3 py-2">
                <Btn kind="ghost" onClick={() => setForm({ ...u, dayIds: u.dayIds ?? [] })}>Edit</Btn>
                <Btn kind="ghost" className="!text-red-700" onClick={() => remove(u)}>Delete</Btn>
              </div>
            </Card>
          ))}
        </div>
      ) : <Card><Empty>No ubayam types yet.</Empty></Card>}

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Edit ubayam type' : 'Add ubayam type'} wide
        footer={<><Btn onClick={() => setForm(null)}>Cancel</Btn><Btn kind="primary" busy={busy} onClick={save}>Save</Btn></>}>
        {form && (
          <div className="space-y-4">
            <BiInput label="Ubayam name" required value={form.name} onChange={(name) => setForm({ ...form, name })} />
            <BiInput label="Description" multiline value={form.description} onChange={(description) => setForm({ ...form, description })} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Price (₹ per booking)"><Input type="number" min={0} value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></Field>
              <Field label="Display order"><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></Field>
            </div>
            <Field label="Available on" hint="Leave all unselected to offer it on every day.">
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
            <div className="flex flex-wrap gap-6">
              <Toggle checked={form.allowFamily} onChange={(allowFamily) => setForm({ ...form, allowFamily })} label="Family booking" />
              <Toggle checked={form.allowGroup} onChange={(allowGroup) => setForm({ ...form, allowGroup })} label="Group booking" />
              <Toggle checked={form.active} onChange={(active) => setForm({ ...form, active })} label="Active" />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
