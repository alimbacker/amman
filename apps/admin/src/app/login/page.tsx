'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/context';
import { Btn, Field, Input } from '@/components/ui';
import { Gopuram, TempleMark } from '@/components/icons';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await login(email, password);
    } catch (e2: unknown) {
      const code = (e2 as { code?: string }).code ?? '';
      setErr(code.includes('too-many-requests') ? 'Too many attempts. Try again later.' : 'Incorrect email or password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-maroon via-crimson-600 to-maroon-900 lg:block">
        <Gopuram className="absolute bottom-0 left-1/2 h-[80%] -translate-x-1/2 text-gold-light/20" />
        <div className="relative p-12 text-cream">
          <TempleMark size={64} />
          <h1 className="mt-6 font-display text-4xl font-bold text-gold-light">ஸ்ரீ கொன்னை அம்மன் ஆலயம்</h1>
          <p className="mt-2 text-lg text-cream/85">Navaratri Ubayam — Administration</p>
        </div>
      </div>
      <div className="grid place-items-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <div className="lg:hidden"><TempleMark size={52} /></div>
          <h2 className="font-display text-2xl font-bold text-maroon">Admin sign in</h2>
          <Field label="Email"><Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          {err && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{err}</div>}
          <Btn kind="primary" type="submit" busy={busy} className="w-full min-h-[2.9rem]">Sign in</Btn>
          <p className="text-xs text-ink-mute">Access is limited to accounts granted the admin role.</p>
        </form>
      </div>
    </div>
  );
}
