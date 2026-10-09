'use client';
import { useEffect, useState } from 'react';
import { collection, getDocs, limit, orderBy, query, startAfter, type DocumentData, type QueryDocumentSnapshot } from 'firebase/firestore';
import { formatDateTime, type AuditLog, type Bilingual, type TempleSettings } from '@temple/shared';
import { getDb, uploadImage } from '@/lib/firebase';
import { useConfig } from '@/lib/context';
import { saveDoc } from '@/lib/write';
import { PageHead } from '@/components/shell';
import { BiInput, Btn, Card, Empty, Field, Input, Select, Toggle, useUi } from '@/components/ui';

type Tab = 'temple' | 'payment' | 'booking' | 'faq' | 'activity';

const DEFAULTS: TempleSettings = {
  templeName: { ta: '', en: '' }, location: { ta: '', en: '' }, address: { ta: '', en: '' }, about: { ta: '', en: '' },
  phone: '', whatsapp: '', logoUrl: '', heroImageUrl: '', upiId: '', upiPayeeName: '', upiQrUrl: '', upiInstructions: { ta: '', en: '' },
  currentFestivalId: '', bookingOpen: true, bookingPrefix: 'KA', holdMinutes: 30, capacityMode: 'bookings', maxMembersPerBooking: 25,
  limitedThresholdPct: 25, faq: [], timezone: 'Asia/Kolkata',
};

export default function SettingsPage() {
  const { settings, loaded } = useConfig();
  const { toast } = useUi();
  const [tab, setTab] = useState<Tab>('temple');
  const [s, setS] = useState<TempleSettings>(DEFAULTS);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (settings && !dirty) setS({ ...DEFAULTS, ...settings }); }, [settings, dirty]);
  const set = (p: Partial<TempleSettings>) => { setS((x) => ({ ...x, ...p })); setDirty(true); };

  async function save() {
    if (!/^[A-Za-z0-9]{1,6}$/.test(s.bookingPrefix)) return toast('Booking prefix: 1–6 letters/digits', 'err');
    if (s.upiId && !/^[\w.\-]{2,}@[\w.\-]{2,}$/.test(s.upiId)) return toast('UPI ID looks invalid (example: templename@okaxis)', 'err');
    setBusy(true);
    try {
      const { currentFestivalId: _ignored, ...rest } = s; // festival is switched from the Festival page
      void _ignored;
      await saveDoc('settings', 'public', {
        ...rest,
        whatsapp: s.whatsapp.replace(/\D/g, ''),
        holdMinutes: Math.max(5, Math.min(240, Math.round(s.holdMinutes))),
        maxMembersPerBooking: Math.max(1, Math.min(100, Math.round(s.maxMembersPerBooking))),
        limitedThresholdPct: Math.max(1, Math.min(90, Math.round(s.limitedThresholdPct))),
      });
      setDirty(false);
      toast('Settings saved — live on the website and app');
    } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
  }

  const tabs: [Tab, string][] = [['temple', 'Temple'], ['payment', 'UPI payment'], ['booking', 'Booking rules'], ['faq', 'Help / FAQ'], ['activity', 'Activity log']];

  return (
    <>
      <PageHead title="Settings" sub="Everything devotees see — nothing is hard-coded."
        actions={tab !== 'activity' && <Btn kind="primary" busy={busy} disabled={!dirty} onClick={save}>{dirty ? 'Save changes' : 'Saved'}</Btn>} />
      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-2 text-sm font-semibold ${tab === k ? 'bg-crimson text-white shadow' : 'bg-white text-ink-soft ring-1 ring-gold/30'}`}>{l}</button>
        ))}
      </div>
      {!loaded ? null : tab === 'temple' ? (
        <Card>
          <div className="grid gap-5 p-5 lg:grid-cols-2">
            <div className="space-y-4">
              <BiInput label="Temple name" required value={s.templeName} onChange={(templeName) => set({ templeName })} />
              <BiInput label="Location" value={s.location} onChange={(location) => set({ location })} />
              <BiInput label="Address" multiline value={s.address} onChange={(address) => set({ address })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Phone"><Input value={s.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+91 90000 00000" /></Field>
                <Field label="WhatsApp number" hint="With country code, e.g. 919000000000"><Input value={s.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} /></Field>
              </div>
            </div>
            <div className="space-y-4">
              <BiInput label="About the temple" multiline value={s.about} onChange={(about) => set({ about })} />
              <div className="grid gap-4 sm:grid-cols-2">
                <ImageField label="Logo" value={s.logoUrl} name="logo" maxSize={400} onChange={(logoUrl) => set({ logoUrl })} round />
                <ImageField label="Hero / temple photo" value={s.heroImageUrl} name="hero" maxSize={1600} onChange={(heroImageUrl) => set({ heroImageUrl })} />
              </div>
            </div>
          </div>
        </Card>
      ) : tab === 'payment' ? (
        <Card>
          <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="UPI ID"><Input className="font-mono" value={s.upiId} onChange={(e) => set({ upiId: e.target.value.trim() })} placeholder="templename@okaxis" /></Field>
                <Field label="Account / temple name (payee)"><Input value={s.upiPayeeName} onChange={(e) => set({ upiPayeeName: e.target.value })} /></Field>
              </div>
              <BiInput label="Payment instructions" multiline value={s.upiInstructions} onChange={(upiInstructions) => set({ upiInstructions })} />
              <p className="rounded-xl bg-saffron-pale p-3 text-sm text-ink-soft">No payment gateway is used. Devotees pay by UPI and enter the UTR; you verify it in <b>Payments</b> against the temple account statement before approving.</p>
            </div>
            <ImageField label="UPI QR code image" value={s.upiQrUrl} name="qr" maxSize={900} onChange={(upiQrUrl) => set({ upiQrUrl })}
              hint="Optional. Without it, a QR is generated from the UPI ID with the exact amount pre-filled." />
          </div>
        </Card>
      ) : tab === 'booking' ? (
        <Card>
          <div className="grid gap-5 p-5 md:grid-cols-2 xl:grid-cols-3">
            <div className="md:col-span-2 xl:col-span-3"><Toggle checked={s.bookingOpen} onChange={(bookingOpen) => set({ bookingOpen })} label={s.bookingOpen ? 'Online booking is OPEN' : 'Online booking is CLOSED'} /></div>
            <Field label="Booking ID prefix" hint={`IDs look like ${s.bookingPrefix || 'KA'}26-0001`}><Input value={s.bookingPrefix} maxLength={6} onChange={(e) => set({ bookingPrefix: e.target.value.toUpperCase() })} /></Field>
            <Field label="Payment hold (minutes)" hint="Unpaid online bookings release their place after this."><Input type="number" min={5} max={240} value={s.holdMinutes} onChange={(e) => set({ holdMinutes: Number(e.target.value) })} /></Field>
            <Field label="Slot capacity counts">
              <Select value={s.capacityMode} onChange={(e) => set({ capacityMode: e.target.value as 'bookings' | 'members' })}>
                <option value="bookings">Bookings (1 per family / group)</option>
                <option value="members">Members (people)</option>
              </Select>
            </Field>
            <Field label="Max members per family"><Input type="number" min={1} max={100} value={s.maxMembersPerBooking} onChange={(e) => set({ maxMembersPerBooking: Number(e.target.value) })} /></Field>
            <Field label="“Limited” when remaining ≤ (% of capacity)"><Input type="number" min={1} max={90} value={s.limitedThresholdPct} onChange={(e) => set({ limitedThresholdPct: Number(e.target.value) })} /></Field>
            <Field label="Time zone"><Input value={s.timezone} onChange={(e) => set({ timezone: e.target.value })} /></Field>
          </div>
          <p className="border-t border-gold/15 px-5 py-3 text-sm text-ink-mute">Changing “capacity counts” affects new bookings only; existing bookings keep the places they hold.</p>
        </Card>
      ) : tab === 'faq' ? (
        <Card actions={<Btn onClick={() => set({ faq: [...s.faq, { q: { ta: '', en: '' }, a: { ta: '', en: '' } }] })}>+ Add question</Btn>} title="Help / FAQ">
          <div className="space-y-4 p-5">
            {s.faq.length === 0 && <Empty>No questions yet.</Empty>}
            {s.faq.map((f, i) => (
              <div key={i} className="space-y-3 rounded-xl border border-gold/25 p-4">
                <BiInput label={`Question ${i + 1}`} value={f.q} onChange={(q: Bilingual) => set({ faq: s.faq.map((x, j) => (j === i ? { ...x, q } : x)) })} />
                <BiInput label="Answer" multiline value={f.a} onChange={(a: Bilingual) => set({ faq: s.faq.map((x, j) => (j === i ? { ...x, a } : x)) })} />
                <div className="flex gap-2">
                  <Btn kind="ghost" disabled={i === 0} onClick={() => { const n = [...s.faq]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; set({ faq: n }); }}>↑</Btn>
                  <Btn kind="ghost" disabled={i === s.faq.length - 1} onClick={() => { const n = [...s.faq]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; set({ faq: n }); }}>↓</Btn>
                  <Btn kind="ghost" className="!text-red-700" onClick={() => set({ faq: s.faq.filter((_, j) => j !== i) })}>Remove</Btn>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : <ActivityLog />}
    </>
  );
}

function ImageField({ label, value, name, onChange, maxSize, round, hint }: { label: string; value: string; name: string; onChange: (url: string) => void; maxSize: number; round?: boolean; hint?: string }) {
  const { toast } = useUi();
  const [busy, setBusy] = useState(false);
  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Choose an image file', 'err');
    setBusy(true);
    try { onChange(await uploadImage(file, name, maxSize)); toast('Uploaded — remember to Save'); }
    catch (err) { toast((err as Error).message, 'err'); } finally { setBusy(false); }
  }
  return (
    <Field label={label} hint={hint}>
      <div className="rounded-xl border border-dashed border-gold/50 bg-cream/50 p-3 text-center">
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt="" className={`mx-auto mb-2 max-h-40 object-contain ${round ? 'h-24 w-24 rounded-full object-cover' : ''}`} />
          : <div className="mb-2 py-6 text-sm text-ink-mute">No image</div>}
        <div className="flex justify-center gap-2">
          <label className="inline-flex min-h-[2.5rem] cursor-pointer items-center rounded-xl border border-maroon/20 bg-white px-4 text-sm font-semibold text-maroon hover:border-maroon/45">
            {busy ? 'Uploading…' : value ? 'Replace' : 'Upload'}
            <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
          </label>
          {value && <Btn kind="ghost" onClick={() => onChange('')}>Remove</Btn>}
        </div>
      </div>
    </Field>
  );
}

function ActivityLog() {
  const [rows, setRows] = useState<AuditLog[]>([]);
  const [cursor, setCursor] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [more, setMore] = useState(true);
  const [busy, setBusy] = useState(false);
  async function load(after: QueryDocumentSnapshot<DocumentData> | null) {
    setBusy(true);
    const snap = await getDocs(query(collection(getDb(), 'auditLogs'), orderBy('createdAt', 'desc'), ...(after ? [startAfter(after)] : []), limit(50)));
    setRows((r) => [...(after ? r : []), ...snap.docs.map((d) => ({ id: d.id, ...d.data() }) as AuditLog)]);
    setCursor(snap.docs[snap.docs.length - 1] ?? null);
    setMore(snap.size === 50);
    setBusy(false);
  }
  useEffect(() => { load(null); }, []);
  return (
    <Card title="Activity log" actions={<Btn onClick={() => load(null)} busy={busy}>Refresh</Btn>}>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[0.88rem]">
            <thead className="border-b border-gold/20 text-[0.72rem] uppercase tracking-wide text-ink-mute"><tr><th className="px-4 py-2.5">When</th><th className="px-3 py-2.5">Who</th><th className="px-3 py-2.5">Action</th><th className="px-3 py-2.5">Target</th><th className="px-3 py-2.5">Details</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id} className="border-b border-gold/10 align-top">
                <td className="whitespace-nowrap px-4 py-2">{formatDateTime(r.createdAt, 'en')}</td>
                <td className="px-3 py-2">{r.actorEmail ?? r.actorUid ?? 'system'}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.action}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.target}</td>
                <td className="max-w-md truncate px-3 py-2 font-mono text-xs text-ink-mute" title={JSON.stringify(r.details)}>{JSON.stringify(r.details)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      ) : <Empty>{busy ? 'Loading…' : 'No activity yet.'}</Empty>}
      {more && rows.length > 0 && <div className="border-t border-gold/15 p-3 text-center"><Btn onClick={() => load(cursor)} busy={busy}>Load more</Btn></div>}
    </Card>
  );
}
