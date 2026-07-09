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

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export default function Register() {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  function validate() {
    if (form.password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return false;
    }
    setPasswordError('');
    return true;
  }

  async function submit() {
    if (!validate()) return;
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

  const canSubmit = !!form.email && !!form.password && !!confirmPassword && form.password === confirmPassword;

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
            <div className="relative">
              <Input
                aria-label="Password"
                type={showPassword ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="At least 10 characters"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Use a passphrase of a few unrelated words, longer is stronger.</p>
          </div>
          <div>
            <Label>Confirm password</Label>
            <div className="relative">
              <Input
                aria-label="Confirm password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setPasswordError(''); }}
                placeholder="Repeat your password"
                className={`pr-10 ${passwordError ? 'border-red-300 focus:border-red-500 focus:ring-red-100' : ''}`}
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <EyeIcon off={showConfirm} />
              </button>
            </div>
            {passwordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
          </div>
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Your name and details will be auto-filled when you upload your I-20. Your data is encrypted end-to-end. We never sell or share it.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button onClick={submit} disabled={busy || !canSubmit} className="w-full">
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
