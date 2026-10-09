'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import { normalizeMobile } from '@temple/shared';
import { usePrefs } from '@/lib/prefs';
import { useTemple } from '@/lib/data';
import { authErrorKey, resetPassword, signIn, signUp } from '@/lib/firebase';
import { LangToggle, LanguageGate, Logo } from './shell';
import { ErrorBox, Spinner } from './ui';
import { Gopuram, IconCheck, IconUser } from './icons';

type Mode = 'signin' | 'signup' | 'reset';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Full-screen sign-in / create-account / reset-password. Shown before anything else on the site. */
export function AuthScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const { t, tr } = usePrefs();
  const { settings } = useTemple();
  const name = settings ? tr(settings.templeName) : 'ஸ்ரீ கொன்னை அம்மன் ஆலயம்';

  return (
    <>
      <LanguageGate />
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
        {/* brand panel */}
        <div className="relative overflow-hidden bg-gradient-to-br from-maroon via-crimson-600 to-maroon-900 text-cream">
          <Gopuram className="absolute bottom-0 left-1/2 hidden h-[70%] -translate-x-1/2 text-gold-light/20 lg:block" />
          <div className="relative flex items-center gap-3 px-5 py-4 lg:block lg:p-12">
            <Logo size={56} />
            <div className="min-w-0 lg:mt-6">
              <h1 className="font-display text-[1.15rem] font-bold leading-tight text-gold-light lg:text-4xl">{name}</h1>
              <p className="text-[0.9rem] text-cream/85 lg:mt-2 lg:text-lg">{t('appTagline')}</p>
            </div>
            <LangToggle className="ml-auto shrink-0 lg:absolute lg:right-6 lg:top-6" />
          </div>
        </div>

        {/* form panel */}
        <div className="grid place-items-start px-5 py-8 lg:place-items-center lg:p-10">
          <div className="w-full max-w-md">
            {mode === 'signin' && <SignInForm onMode={setMode} />}
            {mode === 'signup' && <SignUpForm onMode={setMode} />}
            {mode === 'reset' && <ResetForm onMode={setMode} />}
            <p className="mt-8 text-center text-sm text-ink-mute">{t('accountPrivacy')}</p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ------------------------------ forms ------------------------------ */

function SignInForm({ onMode }: { onMode: (m: Mode) => void }) {
  const { t } = usePrefs();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!EMAIL_RE.test(email.trim())) return setErr(t('err_email'));
    if (!password) return setErr(t('err_required'));
    setBusy(true);
    try {
      await signIn(email, password); // AuthProvider sees the new session and swaps in the app
    } catch (e2) {
      setErr(t(authErrorKey(e2)));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Heading icon={<IconUser size={30} />} title={t('signInTitle')} help={t('signInHelp')} />
      <Field label={t('email')}>
        <input className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <PasswordField label={t('password')} value={password} onChange={setPassword} autoComplete="current-password" />
      <ErrorBox>{err}</ErrorBox>
      <button className="btn-primary w-full text-lg" disabled={busy}>{busy ? <Spinner /> : null} {t('signIn')}</button>
      <button type="button" className="block w-full text-center font-semibold text-crimson underline-offset-2 hover:underline" onClick={() => onMode('reset')}>
        {t('forgotPassword')}
      </button>
      <div className="ornament-rule mx-auto my-2 w-24" />
      <p className="text-center text-ink-soft">{t('noAccount')}</p>
      <button type="button" className="btn-gold w-full text-lg" onClick={() => onMode('signup')}>{t('createAccount')}</button>
    </form>
  );
}

function SignUpForm({ onMode }: { onMode: (m: Mode) => void }) {
  const { t } = usePrefs();
  const [f, setF] = useState({ name: '', mobile: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    const er: Record<string, string> = {};
    if (f.name.trim().length < 2) er.name = t('err_required');
    if (!normalizeMobile(f.mobile)) er.mobile = t('err_mobile');
    if (!EMAIL_RE.test(f.email.trim())) er.email = t('err_email');
    if (f.password.length < 6) er.password = t('err_password');
    if (f.confirm !== f.password) er.confirm = t('err_passwordMatch');
    setErrors(er);
    if (Object.keys(er).length) return;
    setBusy(true);
    try {
      await signUp({ name: f.name, email: f.email, password: f.password, mobile: normalizeMobile(f.mobile) ?? f.mobile });
    } catch (e2) {
      setErr(t(authErrorKey(e2)));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Heading icon={<IconUser size={30} />} title={t('createAccountTitle')} help={t('createAccountHelp')} />
      <Field label={t('fullName')} error={errors.name}>
        <input className="field" autoComplete="name" value={f.name} onChange={(e) => set({ name: e.target.value })} />
      </Field>
      <Field label={t('mobileNumber')} error={errors.mobile}>
        <input className="field" inputMode="numeric" autoComplete="tel-national" placeholder="98765 43210" value={f.mobile}
          onChange={(e) => set({ mobile: e.target.value.replace(/[^\d\s+]/g, '') })} />
      </Field>
      <Field label={t('email')} error={errors.email}>
        <input className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={f.email} onChange={(e) => set({ email: e.target.value })} />
      </Field>
      <PasswordField label={t('password')} value={f.password} onChange={(v) => set({ password: v })} autoComplete="new-password" error={errors.password} />
      <PasswordField label={t('confirmPassword')} value={f.confirm} onChange={(v) => set({ confirm: v })} autoComplete="new-password" error={errors.confirm} />
      <ErrorBox>{err}</ErrorBox>
      <button className="btn-primary w-full text-lg" disabled={busy}>{busy ? <Spinner /> : null} {t('createAccount')}</button>
      <p className="text-center text-ink-soft">
        {t('haveAccount')}{' '}
        <button type="button" className="font-semibold text-crimson underline-offset-2 hover:underline" onClick={() => onMode('signin')}>{t('signIn')}</button>
      </p>
    </form>
  );
}

function ResetForm({ onMode }: { onMode: (m: Mode) => void }) {
  const { t } = usePrefs();
  const [email, setEmail] = useState('');
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr('');
    if (!EMAIL_RE.test(email.trim())) return setErr(t('err_email'));
    setBusy(true);
    try {
      await resetPassword(email);
      setSent(true);
    } catch (e2) {
      // Firebase hides whether the email exists (enumeration protection); treat as sent unless it is a real failure.
      const k = authErrorKey(e2);
      if (k === 'err_userNotFound' || k === 'err_generic') setSent(true); else setErr(t(k));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <Heading title={t('resetTitle')} help={t('resetHelp')} />
      {sent ? (
        <div className="rounded-xl bg-green-50 px-4 py-3 font-medium text-green-800"><IconCheck /> {t('resetSent')}</div>
      ) : (
        <>
          <Field label={t('email')}>
            <input className="field" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <ErrorBox>{err}</ErrorBox>
          <button className="btn-primary w-full text-lg" disabled={busy}>{busy ? <Spinner /> : null} {t('sendResetLink')}</button>
        </>
      )}
      <button type="button" className="btn-outline w-full" onClick={() => onMode('signin')}>{t('backToSignIn')}</button>
    </form>
  );
}

/* ------------------------------ bits ------------------------------ */

function Heading({ icon, title, help }: { icon?: ReactNode; title: string; help: string }) {
  return (
    <div className="mb-2">
      {icon && <div className="mb-3 inline-flex rounded-full bg-saffron-pale p-3 text-crimson">{icon}</div>}
      <h2 className="font-display text-[1.6rem] font-bold text-maroon">{title}</h2>
      <p className="mt-1 text-ink-soft">{help}</p>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

function PasswordField({ label, value, onChange, autoComplete, error }: { label: string; value: string; onChange: (v: string) => void; autoComplete: string; error?: string }) {
  const { t } = usePrefs();
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error}>
      <div className="relative">
        <input className="field pr-20" type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)} />
        <button type="button" aria-pressed={show} aria-label={t('showPassword')} onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-2 my-auto h-9 rounded-full px-3 text-sm font-semibold text-crimson hover:bg-saffron-pale">
          {show ? '🙈' : '👁'}
        </button>
      </div>
    </Field>
  );
}
