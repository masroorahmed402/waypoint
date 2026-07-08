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
    <div className="min-h-screen bg-paper">
      {/* nav */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="font-display text-xl font-semibold text-ink">{APP_NAME}</span>
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">AI</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-slate-600 hover:text-ink">Log in</Link>
          <Link href="/register" className="rounded-lg bg-ink px-4 py-2 text-white transition hover:bg-ink-700">Get started</Link>
        </div>
      </header>

      {/* hero */}
      <section className="mx-auto max-w-3xl px-6 pb-24 pt-20 text-center">
        <p className="mb-5 inline-block rounded-full bg-beacon/15 px-3 py-1 text-xs font-semibold tracking-wide text-beacon-600">
          FOR INTERNATIONAL STUDENTS
        </p>
        <h1 className="font-display text-5xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
          Your AI immigration advisor,<br />personalized to you.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
          Upload your I-20 and {APP_NAME} builds your personal timeline — OPT windows, travel
          signatures, grace periods — then emails you before every deadline. Your documents and
          job search, all in one place.
        </p>

        <div className="mx-auto mt-10 flex max-w-md flex-col gap-2 sm:flex-row">
          {state === 'done' ? (
            <div className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
              You&apos;re on the list — we&apos;ll be in touch. In the meantime, you can{' '}
              <Link href="/register" className="font-medium underline">create your account now</Link>.
            </div>
          ) : (
            <>
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="you@university.edu"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm shadow-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
              />
              <button onClick={submit} disabled={state === 'busy'}
                className="whitespace-nowrap rounded-xl bg-beacon px-6 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-beacon-600 disabled:opacity-50">
                {state === 'busy' ? 'Joining…' : 'Join the waitlist'}
              </button>
            </>
          )}
        </div>
        {state === 'error' && <p className="mt-2 text-sm text-red-600">Something went wrong — try again.</p>}
        <p className="mt-3 text-xs text-slate-400">Free to start. No credit card.</p>
      </section>

      {/* social proof */}
      <section className="border-y border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Built for students navigating F-1, OPT, and CPT
          </p>
          <div className="mt-6 grid grid-cols-3 gap-6 text-center sm:gap-10">
            {[
              { stat: '4', label: 'reminder checkpoints per deadline' },
              { stat: '500MB', label: 'secure document storage' },
              { stat: '$0', label: 'to get started' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl font-semibold text-ink">{s.stat}</div>
                <div className="mt-1 text-xs leading-snug text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-ink">How it works</h2>
          <div className="relative mt-14 grid gap-12 sm:grid-cols-3 sm:gap-6">
            <div
              className="absolute left-0 right-0 top-6 hidden border-t-2 border-dotted border-beacon/40 sm:block"
              style={{ marginLeft: '16.67%', marginRight: '16.67%' }}
            />
            {[
              {
                title: 'Upload your I-20',
                body: 'Drag in your I-20 PDF. Waypoint reads your program dates, STEM status, and CPT/OPT history automatically.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
                    <path d="M14 2v6h6" strokeLinejoin="round" />
                    <path d="M9 15l3-3 3 3M12 12v6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                title: 'See your personal timeline',
                body: 'Your immigration journey appears instantly — every milestone, deadline, and window specific to your dates.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <circle cx="5" cy="6" r="2" />
                    <circle cx="12" cy="18" r="2" />
                    <circle cx="19" cy="10" r="2" />
                    <path d="M5 8v4a2 2 0 0 0 2 2h3M14 18h3a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
              {
                title: 'Never miss what matters',
                body: 'Email reminders at 90, 30, 7, and 1 day before every deadline. Plus an AI advisor that knows your situation.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
            ].map((step, i) => (
              <div key={step.title} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-beacon ring-8 ring-white">
                  {step.icon}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-beacon-600">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* three promises */}
      <section className="bg-paper">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 py-20 sm:grid-cols-3">
          {[
            { t: 'See your whole road', d: 'One I-20 upload becomes a dated timeline from arrival to OPT — no spreadsheets, no guessing.' },
            { t: 'Get warned in time', d: 'Automatic email reminders at 90, 30, 7 and 1 day before each deadline. The dates that can’t be undone, handled.' },
            { t: 'Everything in one place', d: 'Your documents stored securely and your job applications tracked — organized around your visa clock.' },
          ].map((f) => (
            <div key={f.t} className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h3 className="font-display text-lg font-semibold text-ink">{f.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10 text-center">
          <p className="text-xs text-slate-400">
            {APP_NAME} is informational only and not a substitute for legal advice. Always confirm
            immigration matters with your Designated School Official (DSO).
          </p>
          <div className="mt-3 flex justify-center gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/login" className="hover:text-ink">Log in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
