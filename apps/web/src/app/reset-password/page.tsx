'use client';
import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input, Label, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function submit() {
    if (!password) return;
    setBusy(true); setError('');
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword: password }) });
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? 'Could not reset password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-center font-display text-2xl font-semibold text-ink">{APP_NAME}</Link>
      <Card>
        <h1 className="text-xl font-semibold text-ink">Set a new password</h1>
        {!token ? (
          <p className="mt-4 text-sm text-red-600">This reset link is missing its token. Request a new one.</p>
        ) : done ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-emerald-600">Your password has been updated. You can log in now.</p>
            <Button onClick={() => router.push('/login')} className="w-full">Go to log in</Button>
          </div>
        ) : (
          <div className="mt-5 space-y-3">
            <div>
              <Label>New password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button onClick={submit} disabled={busy || !password} className="w-full">
              {busy ? 'Saving…' : 'Reset password'}
            </Button>
          </div>
        )}
        <p className="mt-5 text-center text-sm text-slate-500">
          <Link href="/login" className="font-medium text-ink">Back to log in</Link>
        </p>
      </Card>
    </main>
  );
}
