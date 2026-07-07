'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button, Input, Label, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function submit() {
    if (!email) return;
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
    } finally {
      setBusy(false);
      setDone(true);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-6 text-center font-display text-2xl font-semibold text-ink">{APP_NAME}</Link>
      <Card>
        <h1 className="text-xl font-semibold text-ink">Reset your password</h1>
        {done ? (
          <p className="mt-4 text-sm text-slate-600">
            If an account exists for <strong>{email}</strong>, we&apos;ve sent a password reset link. Check your inbox.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-slate-500">Enter your email and we&apos;ll send you a reset link.</p>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()} />
            </div>
            <Button onClick={submit} disabled={busy || !email} className="w-full">
              {busy ? 'Sending…' : 'Send reset link'}
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
