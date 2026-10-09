'use client';
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  formatDate, formatINR, formatTime, normalizeMobile, slotRemaining, slotState,
  type BookingType, type CreateBookingInput, type CreateBookingResult, type GroupFamily,
} from '@temple/shared';
import { usePrefs, deviceBookings } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { callFn, AppError } from '@/lib/firebase';
import { PageTitle } from '@/components/shell';
import { DayAvailability, DayNumber, todayYmd } from '@/components/days';
import { DetailRow, ErrorBox, SlotBadge, SlotCounts, Skeleton, Spinner } from '@/components/ui';
import { IconCheck, IconChevronLeft, IconClock, IconUser, IconUsers } from '@/components/icons';

interface Draft {
  step: number;
  dayId: string;
  slotId: string;
  ubayamTypeId: string;
  bookingType: BookingType | '';
  contactName: string;
  mobileNumber: string;
  familyName: string;
  memberCount: number;
  memberNames: string;
  groupName: string;
  families: GroupFamily[];
  note: string;
}

const EMPTY: Draft = {
  step: 0, dayId: '', slotId: '', ubayamTypeId: '', bookingType: '', contactName: '', mobileNumber: '',
  familyName: '', memberCount: 1, memberNames: '', groupName: '',
  families: [{ familyName: '', memberCount: 1 }, { familyName: '', memberCount: 1 }], note: '',
};
const DRAFT_KEY = 'bookingDraft.v1';
const STEPS = ['stepDay', 'stepTime', 'stepUbayam', 'stepType', 'stepDetails', 'stepSummary'] as const;

export default function BookPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-6xl p-4"><Skeleton className="mt-10 h-64" /></div>}>
      <Wizard />
    </Suspense>
  );
}

function Wizard() {
  const { t, tr, lang } = usePrefs();
  const temple = useTemple();
  const { settings, activeDays, slotsForDay, ubayamsForDay, bookingOpen, ready, ubayams } = temple;
  const params = useSearchParams();
  const router = useRouter();
  const [d, setD] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const today = todayYmd();
  const maxMembers = settings?.maxMembersPerBooking || 25;

  // restore draft / preselect day from ?day=
  useEffect(() => {
    let draft = EMPTY;
    try { draft = { ...EMPTY, ...JSON.parse(sessionStorage.getItem(DRAFT_KEY) || '{}') }; } catch { /* ignore */ }
    const day = params.get('day');
    if (day && day !== draft.dayId) draft = { ...draft, dayId: day, slotId: '', ubayamTypeId: '', step: 1 };
    setD(draft);
  }, [params]);
  useEffect(() => {
    try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch { /* ignore */ }
  }, [d]);

  const set = (patch: Partial<Draft>) => setD((p) => ({ ...p, ...patch }));
  const go = (step: number) => { set({ step }); setServerError(''); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  const day = activeDays.find((x) => x.id === d.dayId);
  const slots = d.dayId ? slotsForDay(d.dayId) : [];
  const slot = slots.find((s) => s.id === d.slotId);
  const dayUbayams = d.dayId ? ubayamsForDay(d.dayId) : [];
  const ub = ubayams.find((u) => u.id === d.ubayamTypeId);
  const groupMembers = d.families.reduce((s, f) => s + (Number(f.memberCount) || 0), 0);
  const memberTotal = d.bookingType === 'group' ? groupMembers : d.memberCount;

  // If live data invalidates an earlier choice, step back to it.
  useEffect(() => {
    if (!ready || !activeDays.length) return;
    if (d.step > 0 && !day) set({ step: 0, dayId: '' });
    else if (d.step > 1 && !slot) set({ step: 1, slotId: '' });
    else if (d.step > 2 && !ub) set({ step: 2, ubayamTypeId: '' });
  }, [ready, activeDays.length, day, slot, ub, d.step]);

  function validateDetails(): boolean {
    const e: Record<string, string> = {};
    if (d.contactName.trim().length < 2) e.contactName = t('err_required');
    if (!normalizeMobile(d.mobileNumber)) e.mobileNumber = t('err_mobile');
    if (d.bookingType === 'family') {
      if (d.familyName.trim().length < 2) e.familyName = t('err_required');
      if (d.memberCount < 1 || d.memberCount > maxMembers) e.memberCount = t('err_members', { n: maxMembers });
    } else {
      if (d.groupName.trim().length < 2) e.groupName = t('err_required');
      d.families.forEach((f, i) => {
        if (f.familyName.trim().length < 1) e[`fam${i}`] = t('err_required');
        if (f.memberCount < 1 || f.memberCount > maxMembers) e[`famc${i}`] = t('err_members', { n: maxMembers });
      });
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit() {
    if (!slot || !ub || !d.bookingType) return;
    setSubmitting(true);
    setServerError('');
    const input: CreateBookingInput = {
      slotId: slot.id, ubayamTypeId: ub.id, bookingType: d.bookingType,
      contactName: d.contactName.trim(), mobileNumber: d.mobileNumber, note: d.note.trim(),
      ...(d.bookingType === 'family'
        ? { familyName: d.familyName.trim(), memberCount: d.memberCount, memberNames: d.memberNames.split('\n').map((s) => s.trim()).filter(Boolean) }
        : { groupName: d.groupName.trim(), families: d.families.map((f) => ({ familyName: f.familyName.trim(), memberCount: Number(f.memberCount) })) }),
    };
    try {
      const res = await callFn<CreateBookingInput, CreateBookingResult>('createBooking', input, lang);
      deviceBookings.add(res.bookingId);
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/booking?id=${encodeURIComponent(res.bookingId)}`);
    } catch (e) {
      setServerError(e instanceof AppError ? e.message : t('err_generic'));
      if (e instanceof AppError && e.code === 'SLOT_FULL') set({ slotId: '' });
      setSubmitting(false);
    }
  }

  if (ready && !bookingOpen) {
    return (<><PageTitle title={t('bookUbayam')} /><div className="mx-auto max-w-6xl px-4"><div className="card p-8 text-center text-lg font-semibold text-maroon">{t('bookingClosed')}</div></div></>);
  }

  const summaryItems = (
    <dl>
      {day && <DetailRow label={t('day')}>{tr(day.dayName)} · {formatDate(day.date, lang, { year: false })}</DetailRow>}
      {slot && <DetailRow label={t('time')}>{formatTime(slot.time, lang)}</DetailRow>}
      {ub && <DetailRow label={t('ubayam')}>{tr(ub.name)}</DetailRow>}
      {d.bookingType && <DetailRow label={t('familyOrGroup')}>{t(d.bookingType)}</DetailRow>}
      {d.step >= 5 && <DetailRow label={t('members')}>{memberTotal}</DetailRow>}
      {ub && <DetailRow label={t('amount')}><span className="text-lg text-crimson">{formatINR(ub.price)}</span></DetailRow>}
    </dl>
  );

  return (
    <>
      <PageTitle title={t('bookUbayam')} />
      <div className="mx-auto max-w-6xl px-4">
        <Progress step={d.step} onJump={(i) => i < d.step && go(i)} />
        <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            {d.step > 0 && (
              <button onClick={() => go(d.step - 1)} className="btn-ghost -ml-3 mb-2"><IconChevronLeft size={20} />{t('back')}</button>
            )}

            {/* STEP 0 — day */}
            {d.step === 0 && (
              <Section title={t('selectDay')}>
                {!ready && !activeDays.length ? <Skeleton className="h-48" /> : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {activeDays.map((x) => {
                      const past = x.date < today;
                      return (
                        <Choice key={x.id} selected={d.dayId === x.id} disabled={past}
                          onClick={() => { set({ dayId: x.id, slotId: '', ubayamTypeId: '' }); go(1); }}>
                          <div className="flex items-center gap-3">
                            <DayNumber n={x.dayNumber} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[0.9rem] text-ink-soft"><b className="text-crimson">{tr(x.dayName)}</b> · {formatDate(x.date, lang, { weekday: true, year: false })}</div>
                              <div className="font-display font-bold leading-snug text-maroon">{tr(x.title)}</div>
                              <div className="mt-1.5">{!past && <DayAvailability dayId={x.id} />}</div>
                            </div>
                          </div>
                        </Choice>
                      );
                    })}
                  </div>
                )}
              </Section>
            )}

            {/* STEP 1 — time slot */}
            {d.step === 1 && day && (
              <Section title={t('selectTime')} sub={`${tr(day.dayName)} · ${formatDate(day.date, lang, { weekday: true })}`}>
                {slots.length ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {slots.map((s) => {
                      const st = slotState(s, settings?.limitedThresholdPct);
                      const disabled = st === 'full' || st === 'closed';
                      return (
                        <Choice key={s.id} selected={d.slotId === s.id} disabled={disabled}
                          onClick={() => { set({ slotId: s.id }); go(2); }}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 font-display text-[1.4rem] font-bold text-maroon"><IconClock size={22} className="text-gold-dark" />{formatTime(s.time, lang)}</div>
                              {tr(s.label) && <div className="text-ink-soft">{tr(s.label)}</div>}
                            </div>
                            <SlotBadge slot={s} pct={settings?.limitedThresholdPct} />
                          </div>
                          <div className="mt-3 rounded-xl bg-cream-deep/60 p-2"><SlotCounts slot={s} /></div>
                        </Choice>
                      );
                    })}
                  </div>
                ) : <Empty>{t('noSlots')}</Empty>}
              </Section>
            )}

            {/* STEP 2 — ubayam type */}
            {d.step === 2 && (
              <Section title={t('selectUbayam')}>
                {dayUbayams.length ? (
                  <div className="grid gap-3">
                    {dayUbayams.map((u) => (
                      <Choice key={u.id} selected={d.ubayamTypeId === u.id}
                        onClick={() => {
                          const type = u.allowFamily === false ? 'group' : u.allowGroup === false ? 'family' : d.bookingType;
                          set({ ubayamTypeId: u.id, bookingType: type });
                          go(type && (u.allowFamily === false || u.allowGroup === false) ? 4 : 3);
                        }}>
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-display text-[1.15rem] font-bold text-maroon">{tr(u.name)}</div>
                            <div className="mt-0.5 text-ink-soft">{tr(u.description)}</div>
                          </div>
                          <div className="shrink-0 rounded-xl bg-gold-pale px-3 py-1.5 text-lg font-bold text-maroon-900">{formatINR(u.price)}</div>
                        </div>
                      </Choice>
                    ))}
                  </div>
                ) : <Empty>{t('noUbayam')}</Empty>}
              </Section>
            )}

            {/* STEP 3 — family / group */}
            {d.step === 3 && ub && (
              <Section title={t('selectType')}>
                <div className="grid gap-3 sm:grid-cols-2">
                  {ub.allowFamily !== false && (
                    <Choice selected={d.bookingType === 'family'} onClick={() => { set({ bookingType: 'family' }); go(4); }}>
                      <IconUser size={34} className="text-crimson" />
                      <div className="mt-2 font-display text-[1.25rem] font-bold text-maroon">{t('family')}</div>
                      <div className="text-ink-soft">{t('familyDesc')}</div>
                    </Choice>
                  )}
                  {ub.allowGroup !== false && (
                    <Choice selected={d.bookingType === 'group'} onClick={() => { set({ bookingType: 'group' }); go(4); }}>
                      <IconUsers size={34} className="text-crimson" />
                      <div className="mt-2 font-display text-[1.25rem] font-bold text-maroon">{t('group')}</div>
                      <div className="text-ink-soft">{t('groupDesc')}</div>
                    </Choice>
                  )}
                </div>
              </Section>
            )}

            {/* STEP 4 — details */}
            {d.step === 4 && (
              <Section title={t('enterDetails')} sub={d.bookingType ? t(d.bookingType) : ''}>
                <div className="card space-y-5 p-5 md:p-6">
                  <Field label={t('fullName')} error={errors.contactName}>
                    <input className="field" autoComplete="name" value={d.contactName} onChange={(e) => set({ contactName: e.target.value })} />
                  </Field>
                  <Field label={t('mobileNumber')} error={errors.mobileNumber}>
                    <div className="flex">
                      <span className="flex items-center rounded-l-xl border-2 border-r-0 border-gold/30 bg-cream-deep px-3 font-semibold text-ink-soft">+91</span>
                      <input className="field min-w-0 rounded-l-none" inputMode="numeric" autoComplete="tel-national" maxLength={14} placeholder="98765 43210"
                        value={d.mobileNumber} onChange={(e) => set({ mobileNumber: e.target.value.replace(/[^\d\s]/g, '') })} />
                    </div>
                  </Field>

                  {d.bookingType === 'family' ? (
                    <>
                      <Field label={t('familyName')} error={errors.familyName}>
                        <input className="field" placeholder={t('familyNamePh')} value={d.familyName} onChange={(e) => set({ familyName: e.target.value })} />
                      </Field>
                      <Field label={t('memberCount')} error={errors.memberCount}>
                        <Stepper value={d.memberCount} max={maxMembers} onChange={(n) => set({ memberCount: n })} />
                      </Field>
                      <Field label={t('memberNames')}>
                        <textarea className="field min-h-[6rem]" placeholder={t('memberNamesPh')} value={d.memberNames} onChange={(e) => set({ memberNames: e.target.value })} />
                      </Field>
                    </>
                  ) : (
                    <>
                      <Field label={t('groupName')} error={errors.groupName}>
                        <input className="field" placeholder={t('groupNamePh')} value={d.groupName} onChange={(e) => set({ groupName: e.target.value })} />
                      </Field>
                      <div>
                        <div className="field-label">{t('families')}</div>
                        <div className="space-y-3">
                          {d.families.map((f, i) => (
                            <div key={i} className="rounded-xl border border-gold/30 bg-cream/60 p-3">
                              <div className="mb-2 flex items-center justify-between text-sm font-semibold text-ink-soft">
                                <span>{t('family')} {i + 1}</span>
                                {d.families.length > 2 && (
                                  <button type="button" className="text-crimson underline" onClick={() => set({ families: d.families.filter((_, j) => j !== i) })}>{t('remove')}</button>
                                )}
                              </div>
                              <input className="field" placeholder={t('familyName')} value={f.familyName}
                                onChange={(e) => set({ families: d.families.map((x, j) => (j === i ? { ...x, familyName: e.target.value } : x)) })} />
                              {errors[`fam${i}`] && <div className="field-error">{errors[`fam${i}`]}</div>}
                              <div className="mt-2 flex items-center justify-between gap-3">
                                <span className="text-ink-soft">{t('members')}</span>
                                <Stepper value={f.memberCount} max={maxMembers} compact
                                  onChange={(n) => set({ families: d.families.map((x, j) => (j === i ? { ...x, memberCount: n } : x)) })} />
                              </div>
                              {errors[`famc${i}`] && <div className="field-error">{errors[`famc${i}`]}</div>}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          {d.families.length < 50 && (
                            <button type="button" className="btn-outline min-h-[2.75rem] px-4" onClick={() => set({ families: [...d.families, { familyName: '', memberCount: 1 }] })}>{t('addFamily')}</button>
                          )}
                          <div className="font-semibold text-maroon">{t('totalMembers')}: {groupMembers}</div>
                        </div>
                      </div>
                    </>
                  )}

                  <Field label={t('note')}>
                    <textarea className="field min-h-[5rem]" maxLength={500} value={d.note} onChange={(e) => set({ note: e.target.value })} />
                  </Field>
                  <button className="btn-primary w-full text-lg" onClick={() => validateDetails() && go(5)}>{t('next')}</button>
                </div>
              </Section>
            )}

            {/* STEP 5 — summary */}
            {d.step === 5 && slot && ub && day && (
              <Section title={t('summary')} sub={t('checkDetails')}>
                <div className="card overflow-hidden">
                  <div className="bg-gradient-to-r from-maroon to-crimson-600 px-5 py-4 text-cream">
                    <div className="font-display text-[1.25rem] font-bold text-gold-light">{tr(ub.name)}</div>
                    <div>{tr(day.dayName)} · {formatDate(day.date, lang, { weekday: true })} · {formatTime(slot.time, lang)}</div>
                  </div>
                  <dl className="px-5 py-2">
                    <DetailRow label={t('fullName')}>{d.contactName}</DetailRow>
                    <DetailRow label={t('mobileNumber')}>{normalizeMobile(d.mobileNumber)}</DetailRow>
                    {d.bookingType === 'family' ? (
                      <>
                        <DetailRow label={t('familyName')}>{d.familyName}</DetailRow>
                        <DetailRow label={t('members')}>{d.memberCount}</DetailRow>
                      </>
                    ) : (
                      <>
                        <DetailRow label={t('groupName')}>{d.groupName}</DetailRow>
                        <DetailRow label={t('families')}>
                          <ul className="space-y-0.5">{d.families.map((f, i) => <li key={i}>{f.familyName} – {f.memberCount}</li>)}</ul>
                        </DetailRow>
                        <DetailRow label={t('totalMembers')}>{groupMembers}</DetailRow>
                      </>
                    )}
                    {d.note && <DetailRow label={t('note')}>{d.note}</DetailRow>}
                    <DetailRow label={t('remaining')}>{slotRemaining(slot)}</DetailRow>
                  </dl>
                  <div className="flex flex-wrap items-center justify-between gap-x-3 border-t border-gold/30 bg-gold-pale/50 px-5 py-4">
                    <span className="font-semibold text-ink-soft">{t('amountToPay')}</span>
                    <span className="font-display text-[1.7rem] font-bold text-crimson">{formatINR(ub.price)}</span>
                  </div>
                </div>
                <p className="mt-3 text-ink-soft">{t('holdNotice', { m: settings?.holdMinutes ?? 30 })}</p>
                <div className="mt-4"><ErrorBox>{serverError}</ErrorBox></div>
                <button className="btn-gold mt-4 w-full min-h-[3.75rem] text-[1.15rem]" disabled={submitting} onClick={submit}>
                  {submitting ? <Spinner /> : <IconCheck />} {t('proceedToPay')}
                </button>
              </Section>
            )}
          </div>

          {/* desktop sticky summary */}
          <aside className="hidden lg:block">
            <div className="card sticky top-28 p-5">
              <div className="font-display text-lg font-bold text-maroon">{t('summary')}</div>
              <div className="mb-1 mt-2 w-16 ornament-rule" />
              {d.dayId ? summaryItems : <p className="py-4 text-ink-mute">{t('selectDay')}</p>}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function Progress({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  const { t } = usePrefs();
  return (
    <ol className="rail flex gap-1.5 pb-1" aria-label="progress">
      {STEPS.map((k, i) => (
        <li key={k} className={`min-w-0 ${i === step ? 'flex-[2.5] sm:flex-1' : 'flex-1'}`}>
          <button type="button" onClick={() => onJump(i)} disabled={i >= step} className="w-full text-left">
            <div className={`h-1.5 rounded-full ${i <= step ? 'bg-gradient-to-r from-gold to-crimson' : 'bg-gold/20'}`} />
            <div className={`mt-1 truncate text-[0.78rem] font-semibold ${i === step ? 'text-crimson' : `hidden sm:block ${i < step ? 'text-ink-soft' : 'text-ink-mute/70'}`}`}>
              {i + 1}. {t(k)}
            </div>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-[1.3rem] font-bold text-maroon md:text-[1.5rem]">{title}</h2>
      {sub && <p className="text-ink-soft">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Choice({ selected, disabled, onClick, children }: { selected?: boolean; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={selected}
      className={`relative w-full rounded-xl2 border-2 bg-white p-4 text-left shadow-card transition md:p-5 ${
        selected ? 'border-crimson ring-4 ring-crimson/10' : 'border-gold/25 hover:border-gold'
      } ${disabled ? 'cursor-not-allowed opacity-50 grayscale-[.4]' : 'active:scale-[.99]'}`}>
      {selected && <span className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-full bg-crimson text-white"><IconCheck size={16} /></span>}
      {children}
    </button>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error block">{error}</span>}
    </label>
  );
}

function Stepper({ value, onChange, max, compact }: { value: number; onChange: (n: number) => void; max: number; compact?: boolean }) {
  const b = `grid place-items-center rounded-xl border-2 border-gold/40 bg-white text-2xl font-bold text-maroon active:bg-gold-pale disabled:opacity-40 ${compact ? 'h-11 w-11' : 'h-14 w-14'}`;
  return (
    <div className="flex items-center gap-3">
      <button type="button" className={b} disabled={value <= 1} onClick={() => onChange(Math.max(1, value - 1))} aria-label="−">−</button>
      <input className={`field text-center text-xl font-bold ${compact ? 'w-16 px-1 py-2' : 'w-20'}`} inputMode="numeric" value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0)))} />
      <button type="button" className={b} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} aria-label="+">+</button>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-8 text-center text-ink-soft">{children}</div>;
}

