'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Button, Input, Label, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export default function Login() {
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
      const res = await api<{ accessToken: string }>('/auth/login', {
        method: 'POST', body: JSON.stringify(form),
      });
      setAccessToken(res.accessToken);
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
        <h1 className="text-xl font-semibold">Welcome back</h1>
        <div className="mt-5 space-y-3">
          <div><Label>Email</Label><Input type="email" value={form.email} onChange={set('email')} /></div>
          <div><Label>Password</Label><Input type="password" value={form.password} onChange={set('password')}
            onKeyDown={(e) => e.key === 'Enter' && submit()} /></div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={submit} disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Log in'}</Button>
          <a href={`${API}/auth/google`} className="block">
            <Button variant="ghost" className="w-full" type="button">Continue with Google</Button>
          </a>
        </div>
        <p className="mt-5 text-center text-sm text-slate-500">
          New here? <Link href="/register" className="font-medium text-ink">Create an account</Link>
        </p>
      </Card>
    </main>
  );
}
