'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Label, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';
import { track } from '@/lib/posthog';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function Register() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setBusy(true); setError('');
    try {
      const res = await api<{ accessToken: string }>('/auth/register', {
        method: 'POST', body: JSON.stringify(form),
      });
      setAccessToken(res.accessToken);
      track('signup');
      await refreshMe();
      router.push('/dashboard');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-center font-display text-2xl font-semibold text-ink">{APP_NAME}</Link>
      <Card>
        <h1 className="text-xl font-semibold">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Start tracking your immigration timeline and job search.</p>

        <div className="mt-5 space-y-3">
          <div><Label>Email</Label><Input aria-label="Email" type="email" value={form.email} onChange={set('email')} /></div>
          <div>
            <Label>Password</Label>
            <Input aria-label="Password" type="password" value={form.password} onChange={set('password')} placeholder="At least 10 characters" />
            <p className="mt-1 text-xs text-slate-400">Use a passphrase of a few unrelated words, longer is stronger.</p>
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Your name and details will be auto-filled when you upload your I-20. Your data is encrypted end-to-end. We never sell or share it.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">
            {busy ? 'Creating…' : 'Create account'}
          </Button>
          <a href={`${API}/auth/google`} className="block">
            <Button variant="ghost" className="w-full" type="button">Continue with Google</Button>
          </a>
        </div>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account? <Link href="/login" className="font-medium text-ink">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
