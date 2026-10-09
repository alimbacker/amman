'use client';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { paymentStage, type Bilingual, type Booking } from '@temple/shared';

/* ---------- primitives ---------- */

export function Card({ children, className = '', title, actions }: { children: ReactNode; className?: string; title?: ReactNode; actions?: ReactNode }) {
  return (
    <section className={`rounded-2xl border border-gold/20 bg-white shadow-card ${className}`}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/15 px-5 py-3.5">
          <h2 className="font-display text-[1.05rem] font-bold text-maroon">{title}</h2>
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        </header>
      )}
      {children}
    </section>
  );
}

type BtnKind = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger' | 'success';
export function Btn({ kind = 'outline', className = '', busy, children, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: BtnKind; busy?: boolean }) {
  const k: Record<BtnKind, string> = {
    primary: 'bg-crimson text-white hover:bg-crimson-600 shadow-sm',
    gold: 'bg-gradient-to-b from-gold-light to-gold text-maroon-900 hover:brightness-105 shadow-sm',
    outline: 'border border-maroon/20 bg-white text-maroon hover:border-maroon/45',
    ghost: 'text-maroon hover:bg-maroon-50',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    success: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm',
  };
  return (
    <button {...p} disabled={p.disabled || busy}
      className={`inline-flex min-h-[2.5rem] items-center justify-center gap-2 rounded-xl px-4 text-[0.92rem] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${k[kind]} ${className}`}>
      {busy && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />}
      {children}
    </button>
  );
}

export function Field({ label, hint, children, className = '' }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[0.82rem] font-semibold uppercase tracking-wide text-ink-soft">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-mute">{hint}</span>}
    </label>
  );
}

export const inputCls = 'w-full rounded-xl border border-gold/35 bg-white px-3 py-2.5 text-[0.95rem] outline-none transition focus:border-gold focus:ring-4 focus:ring-gold-pale disabled:bg-stone-50';

export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={`${inputCls} ${p.className ?? ''}`} />;
}
export function Textarea(p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={`${inputCls} min-h-[5rem] ${p.className ?? ''}`} />;
}
export function Select({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={`${inputCls} pr-8 ${p.className ?? ''}`}>{children}</select>;
}

/** Tamil + English side by side. */
export function BiInput({ label, value, onChange, multiline, required }: { label: string; value: Bilingual; onChange: (v: Bilingual) => void; multiline?: boolean; required?: boolean }) {
  const C = multiline ? Textarea : Input;
  return (
    <div>
      <span className="mb-1 block text-[0.82rem] font-semibold uppercase tracking-wide text-ink-soft">{label}{required && ' *'}</span>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="relative">
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-gold-pale px-1.5 text-[0.7rem] font-bold text-gold-dark">தமிழ்</span>
          <C value={value?.ta ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ ...value, ta: e.target.value })} />
        </div>
        <div className="relative">
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-stone-100 px-1.5 text-[0.7rem] font-bold text-stone-500">EN</span>
          <C value={value?.en ?? ''} onChange={(e: React.ChangeEvent<HTMLInputElement & HTMLTextAreaElement>) => onChange({ ...value, en: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2.5">
      <span className={`relative h-6 w-11 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[1.375rem]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-[0.92rem] font-medium">{label}</span>}
    </button>
  );
}

const tones = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/30',
  red: 'bg-red-50 text-red-800 ring-red-600/25',
  gray: 'bg-stone-100 text-stone-700 ring-stone-500/25',
  blue: 'bg-sky-50 text-sky-800 ring-sky-600/25',
  maroon: 'bg-maroon-50 text-maroon ring-maroon/20',
};
export function Badge({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.75rem] font-semibold ring-1 ${tones[tone]}`}>{children}</span>;
}
export function PayBadge({ b }: { b: Pick<Booking, 'paymentStatus' | 'paymentSubmitted'> }) {
  const s = paymentStage(b);
  const m = { awaiting_payment: ['amber', 'Awaiting payment'], verifying: ['blue', 'Verify'], paid: ['green', 'Paid'], rejected: ['red', 'Rejected'] } as const;
  return <Badge tone={m[s][0]}>{m[s][1]}</Badge>;
}
export function StatusBadge({ s }: { s: Booking['bookingStatus'] }) {
  const m = { pending: 'amber', confirmed: 'green', cancelled: 'gray', completed: 'blue' } as const;
  return <Badge tone={m[s]}>{s[0].toUpperCase() + s.slice(1)}</Badge>;
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="px-5 py-12 text-center text-ink-mute">{children}</div>;
}
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gold-pale/60 ${className}`} />;
}

/* ---------- overlays ---------- */

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-maroon-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <header className="flex items-center justify-between border-b border-gold/20 px-5 py-4">
          <h3 className="font-display text-lg font-bold text-maroon">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-2xl leading-none text-ink-mute hover:bg-stone-100" aria-label="Close">×</button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-gold/20 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}

/* ---------- toast + confirm ---------- */

type Toast = { id: number; text: string; tone: 'ok' | 'err' };
type ConfirmReq = { title: string; body?: string; confirm: string; danger?: boolean; input?: string; resolve: (v: string | false) => void };
const UiCtx = createContext<{ toast: (text: string, tone?: 'ok' | 'err') => void; confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<string | false> } | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [req, setReq] = useState<ConfirmReq | null>(null);
  const [text, setText] = useState('');
  const toast = useCallback((t: string, tone: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x, { id, text: t, tone }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), tone === 'err' ? 7000 : 3500);
  }, []);
  const confirm = useCallback((o: Omit<ConfirmReq, 'resolve'>) => new Promise<string | false>((resolve) => { setText(''); setReq({ ...o, resolve }); }), []);
  const close = (v: string | false) => { req?.resolve(v); setReq(null); };
  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(92vw,380px)] flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} role="status" className={`rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'ok' ? 'bg-emerald-700' : 'bg-red-700'}`}>{t.text}</div>
        ))}
      </div>
      <Modal open={!!req} onClose={() => close(false)} title={req?.title ?? ''}
        footer={<>
          <Btn onClick={() => close(false)}>Cancel</Btn>
          <Btn kind={req?.danger ? 'danger' : 'primary'} disabled={!!req?.input && text.trim().length < 2} onClick={() => close(req?.input ? text.trim() : 'yes')}>{req?.confirm}</Btn>
        </>}>
        {req?.body && <p className="text-ink-soft">{req.body}</p>}
        {req?.input && <Field label={req.input} className="mt-3"><Textarea autoFocus value={text} onChange={(e) => setText(e.target.value)} /></Field>}
      </Modal>
    </UiCtx.Provider>
  );
}
export function useUi() {
  const v = useContext(UiCtx);
  if (!v) throw new Error('useUi outside provider');
  return v;
}

/* ---------- export helpers ---------- */

export type Col<T> = { key: string; label: string; get: (r: T) => string | number };

export function toCsv<T>(rows: T[], cols: Col<T>[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.map((c) => esc(c.label)).join(','), ...rows.map((r) => cols.map((c) => esc(c.get(r))).join(','))].join('\r\n');
}

function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function exportCsv<T>(rows: T[], cols: Col<T>[], name: string) {
  // BOM so Excel opens Tamil text correctly
  download(new Blob(['﻿' + toCsv(rows, cols)], { type: 'text/csv;charset=utf-8' }), `${name}.csv`);
}

export async function exportXlsx<T>(rows: T[], cols: Col<T>[], name: string) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(name.slice(0, 31));
  ws.columns = cols.map((c) => ({ header: c.label, key: c.key, width: Math.max(12, c.label.length + 4) }));
  rows.forEach((r) => ws.addRow(Object.fromEntries(cols.map((c) => [c.key, c.get(r)]))));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF6B0F1A' } };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  const buf = await wb.xlsx.writeBuffer();
  download(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${name}.xlsx`);
}

export function ExportButtons<T>({ rows, cols, name }: { rows: T[]; cols: Col<T>[]; name: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Btn onClick={() => exportCsv(rows, cols, name)} disabled={!rows.length}>CSV</Btn>
      <Btn busy={busy} disabled={!rows.length} onClick={async () => { setBusy(true); try { await exportXlsx(rows, cols, name); } finally { setBusy(false); } }}>Excel</Btn>
    </>
  );
}
