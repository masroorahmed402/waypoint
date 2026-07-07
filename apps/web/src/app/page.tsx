'use client';
import { useState } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { joinWaitlist } from '@/lib/waitlist';
import { track } from '@/lib/posthog';

export default function Home() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit() {
    if (!email) return;
    setState('busy');
    try { await joinWaitlist(email); track('waitlist_joined'); setState('done'); }
    catch { setState('error'); }
  }

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-display text-xl font-semibold text-ink">{APP_NAME}</span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-ink">Log in</Link>
          <Link href="/register" className="rounded-lg bg-ink px-4 py-2 text-white hover:bg-ink-700">Get started</Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-6 pt-16 pb-20 text-center">
        <p className="mb-4 inline-block rounded-full bg-beacon/15 px-3 py-1 text-xs font-medium text-beacon-600">
          For international students
        </p>
        <h1 className="font-display text-5xl font-semibold leading-tight text-ink sm:text-6xl">
          Never miss an<br />immigration deadline.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-slate-600">
          Upload your I-20 and {APP_NAME} builds your personal timeline — OPT windows, travel
          signatures, grace periods — then emails you before every deadline. Your documents and
          job search, all in one place.
        </p>

        <div className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
          {state === 'done' ? (
            <div className="w-full rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              You&apos;re on the list — we&apos;ll be in touch. In the meantime, you can{' '}
              <Link href="/register" className="font-medium underline">create your account now</Link>.
            </div>
          ) : (
            <>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="you@university.edu"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
              />
              <button onClick={submit} disabled={state === 'busy'}
                className="whitespace-nowrap rounded-lg bg-beacon px-5 py-3 text-sm font-semibold text-ink hover:bg-beacon-600 disabled:opacity-50">
                {state === 'busy' ? 'Joining…' : 'Join the waitlist'}
              </button>
            </>
          )}
        </div>
        {state === 'error' && <p className="mt-2 text-sm text-red-600">Something went wrong — try again.</p>}
        <p className="mt-3 text-xs text-slate-400">Free to start. No credit card.</p>
      </section>

      {/* three promises */}
      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
          {[
            { t: 'See your whole road', d: 'One I-20 upload becomes a dated timeline from arrival to OPT — no spreadsheets, no guessing.' },
            { t: 'Get warned in time', d: 'Automatic email reminders at 90, 30, 7 and 1 day before each deadline. The dates that can’t be undone, handled.' },
            { t: 'Everything in one place', d: 'Your documents stored securely and your job applications tracked — organized around your visa clock.' },
          ].map((f) => (
            <div key={f.t}>
              <h3 className="font-display text-lg font-semibold text-ink">{f.t}</h3>
              <p className="mt-2 text-sm text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="mx-auto max-w-5xl px-6 py-10 text-center">
        <p className="text-xs text-slate-400">
          {APP_NAME} is informational only and not a substitute for legal advice. Always confirm
          immigration matters with your Designated School Official (DSO).
        </p>
        <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/login" className="hover:text-ink">Log in</Link>
        </div>
      </footer>
    </div>
  );
}
