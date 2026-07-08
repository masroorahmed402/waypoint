'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { joinWaitlist } from '@/lib/waitlist';
import { track } from '@/lib/posthog';
import RevealOnScroll from '@/components/reveal-on-scroll';

const FEATURES = [
  { icon: '🤖', title: 'AI Advisor', body: 'Ask anything. Get answers based on YOUR program dates, CPT history, and visa type.' },
  { icon: '📄', title: 'I-20 Intelligence', body: 'Upload your I-20 PDF. We extract your dates, detect STEM eligibility, and find your DSO automatically.' },
  { icon: '⏰', title: 'Deadline Guardian', body: 'Email alerts at 90, 30, 7, and 1 day before every immigration deadline. Never miss OPT again.' },
  { icon: '📁', title: 'Document Vault', body: 'Store your I-20, passport, and visa securely. Get expiry reminders before they lapse.' },
  { icon: '💼', title: 'Job Tracker', body: 'Track applications with H-1B sponsorship data. Know which companies sponsor before you apply.' },
  { icon: '🎓', title: 'STEM Detection', body: 'We automatically detect if your degree qualifies for 24-month STEM OPT extension.' },
  { icon: '🏥', title: 'Arrival Checklist', body: 'From SSN to driver’s license — a step-by-step guide for every new student.' },
  { icon: '📧', title: 'DSO Email Drafter', body: 'AI writes professional emails to your DSO pre-filled with your SEVIS ID and program dates.' },
  { icon: '📊', title: 'USCIS Case Tracker', body: 'Add your receipt number. Get notified the moment your OPT/EAD status changes.' },
  { icon: '🗓️', title: 'Calendar Export', body: 'Export all your deadlines to Google Calendar with one click.' },
];

const DEMO_TIMELINE = [
  { label: 'Program start', date: 'Sep 2023', status: 'done' },
  { label: 'CPT authorized', date: 'Jun 2025', status: 'done' },
  { label: 'OPT window opens', date: 'Mar 2027', status: 'current' },
  { label: 'Program ends', date: 'Jun 2027', status: 'upcoming' },
  { label: 'OPT filing deadline', date: 'Aug 2027', status: 'upcoming' },
];

const DEMO_DEADLINES = [
  { title: 'Submit OPT application (I-765)', when: 'in 62 days', urgency: 'amber' },
  { title: 'Travel signature renewal', when: 'in 14 days', urgency: 'red' },
  { title: 'STEM OPT reporting check-in', when: 'in 5 months', urgency: 'green' },
];

const ADVISOR_QUESTIONS = [
  'Am I eligible for OPT?',
  'How much CPT have I used?',
  'What happens during the 60-day grace period?',
  'Draft an email to my DSO about OPT',
  'Can I travel internationally right now?',
  'When does my I-20 travel signature expire?',
];

function FloatingDots() {
  const dots = [
    { top: '15%', left: '8%', size: 8, delay: 0 },
    { top: '30%', left: '85%', size: 6, delay: 1.2 },
    { top: '65%', left: '15%', size: 10, delay: 2.4 },
    { top: '75%', left: '70%', size: 7, delay: 0.6 },
    { top: '45%', left: '50%', size: 5, delay: 1.8 },
    { top: '20%', left: '45%', size: 6, delay: 3 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full opacity-30">
        <line x1="8%" y1="15%" x2="45%" y2="20%" stroke="#e6a53a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="45%" y1="20%" x2="85%" y2="30%" stroke="#e6a53a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="15%" y1="65%" x2="50%" y2="45%" stroke="#e6a53a" strokeWidth="1" strokeDasharray="4 4" />
        <line x1="50%" y1="45%" x2="70%" y2="75%" stroke="#e6a53a" strokeWidth="1" strokeDasharray="4 4" />
      </svg>
      {dots.map((d, i) => (
        <span
          key={i}
          className="absolute animate-float rounded-full bg-beacon/60"
          style={{ top: d.top, left: d.left, width: d.size, height: d.size, animationDelay: `${d.delay}s` }}
        />
      ))}
    </div>
  );
}

function Typewriter({ words }: { words: string[] }) {
  const [wordIdx, setWordIdx] = useState(0);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIdx];
    const speed = deleting ? 25 : 45;
    const timeout = setTimeout(() => {
      if (!deleting) {
        if (text.length < current.length) {
          setText(current.slice(0, text.length + 1));
        } else {
          setTimeout(() => setDeleting(true), 1400);
        }
      } else if (text.length > 0) {
        setText(current.slice(0, text.length - 1));
      } else {
        setDeleting(false);
        setWordIdx((i) => (i + 1) % words.length);
      }
    }, speed);
    return () => clearTimeout(timeout);
  }, [text, deleting, wordIdx, words]);

  return (
    <span>
      {text}
      <span className="ml-0.5 inline-block w-[2px] animate-pulse bg-ink align-middle" style={{ height: '1em' }} />
    </span>
  );
}

function DemoTabs() {
  const [tab, setTab] = useState<'timeline' | 'advisor' | 'deadlines'>('timeline');
  const tabs = [
    { key: 'timeline' as const, label: 'Your timeline' },
    { key: 'advisor' as const, label: 'AI Advisor' },
    { key: 'deadlines' as const, label: 'Deadline tracker' },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex gap-1 border-b border-slate-100 p-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.key ? 'bg-ink text-white' : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="min-h-[280px] animate-fade-in p-5">
        {tab === 'timeline' && (
          <div className="space-y-4">
            {DEMO_TIMELINE.map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 shrink-0 rounded-full ${
                    m.status === 'done' ? 'bg-slate-300' : m.status === 'current' ? 'animate-pulse-beacon bg-beacon' : 'border-2 border-slate-300 bg-white'
                  }`}
                />
                <span className={`flex-1 text-sm ${m.status === 'current' ? 'font-semibold text-ink' : 'text-slate-600'}`}>{m.label}</span>
                <span className="text-xs text-slate-400">{m.date}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 'advisor' && (
          <div className="space-y-3">
            <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-white">
              Am I eligible for OPT?
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-700">
              Yes — based on your program end date of June 2027, your OPT application window opens
              90 days before that, in March 2027. You&apos;ll need to file within 30 days of your DSO
              recommending you in SEVIS.
            </div>
          </div>
        )}
        {tab === 'deadlines' && (
          <div className="space-y-2">
            {DEMO_DEADLINES.map((d) => (
              <div
                key={d.title}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                  d.urgency === 'red' ? 'border-red-200 bg-red-50' : d.urgency === 'amber' ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
                }`}
              >
                <span className="text-slate-700">{d.title}</span>
                <span
                  className={`font-semibold ${
                    d.urgency === 'red' ? 'text-red-600' : d.urgency === 'amber' ? 'text-amber-600' : 'text-emerald-600'
                  }`}
                >
                  {d.when}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
      <section className="relative overflow-hidden">
        <FloatingDots />
        <div className="relative mx-auto max-w-3xl px-6 pb-20 pt-16 text-center">
          <p className="mb-5 inline-block rounded-full bg-beacon/15 px-3 py-1 text-xs font-semibold tracking-wide text-beacon-600">
            FOR INTERNATIONAL STUDENTS
          </p>
          <h1 className="font-display text-5xl font-semibold leading-[1.1] tracking-tight text-ink sm:text-6xl">
            The AI that knows your<br />visa better than you do
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Upload your I-20. Get your personal immigration timeline, deadline reminders, and an AI
            advisor that answers based on YOUR actual dates — not generic USCIS text.
          </p>

          <div className="mx-auto mt-10 flex max-w-md flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/register"
              className="w-full whitespace-nowrap rounded-xl bg-beacon px-8 py-3.5 text-base font-semibold text-ink shadow-sm transition hover:bg-beacon-600 sm:w-auto"
            >
              Get started free
            </Link>
            <a
              href="#how-it-works"
              className="w-full whitespace-nowrap rounded-xl border border-slate-300 px-8 py-3.5 text-base font-medium text-ink transition hover:bg-slate-50 sm:w-auto"
            >
              See how it works
            </a>
          </div>
          <p className="mt-4 text-xs text-slate-400">Free to start. No credit card.</p>

          <p className="mt-14 text-xs font-medium uppercase tracking-wide text-slate-400">
            Used by international students at DePaul · UIUC · Northwestern · NYU · Purdue
          </p>
        </div>
      </section>

      {/* interactive demo */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-beacon-600">See it in action</p>
          <h2 className="mt-2 text-center font-display text-3xl font-semibold text-ink">
            Here&apos;s what {APP_NAME} looks like for a DePaul CS student graduating June 2027
          </h2>
          <div className="mt-10">
            <DemoTabs />
          </div>
        </div>
      </section>

      {/* feature highlights */}
      <section className="bg-paper py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-ink">Everything you need, in one place</h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <RevealOnScroll key={f.title} delay={(i % 3) * 100}>
                <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* how it works */}
      <section id="how-it-works" className="bg-white py-20">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-ink">How it works</h2>
          <div className="relative mt-14 grid gap-12 sm:grid-cols-3 sm:gap-6">
            <div
              className="absolute left-0 right-0 top-6 hidden border-t-2 border-dotted border-beacon/40 sm:block"
              style={{ marginLeft: '16.67%', marginRight: '16.67%' }}
            />
            {[
              {
                title: 'Upload your I-20 (30 seconds)',
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
                title: 'See your personal timeline (instant)',
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
                title: 'Never miss a deadline (ongoing)',
                body: 'Email reminders at 90, 30, 7, and 1 day before every deadline. Plus an AI advisor that knows your situation.',
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                    <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ),
              },
            ].map((step, i) => (
              <RevealOnScroll key={step.title} delay={i * 150} className="relative flex flex-col items-center text-center">
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-ink text-beacon ring-8 ring-white">
                  {step.icon}
                </div>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-beacon-600">Step {i + 1}</p>
                <h3 className="mt-1 font-display text-lg font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* stats */}
      <section className="border-y border-slate-200 bg-paper py-14">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Built specifically for F-1 students
          </p>
          <div className="mt-8 grid grid-cols-2 gap-6 text-center sm:grid-cols-4 sm:gap-10">
            {[
              { stat: '3 min', label: 'to set up' },
              { stat: '90+ days', label: 'early warning' },
              { stat: '24 mo', label: 'STEM OPT tracking' },
              { stat: '100%', label: 'free to start' },
            ].map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl font-semibold text-ink">{s.stat}</div>
                <div className="mt-1 text-xs leading-snug text-slate-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">Your documents, protected</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              { icon: '🔒', title: 'AES-256 encryption', body: 'The same standard used by banks.' },
              { icon: '🚫', title: 'Zero data sharing', body: 'Your documents never leave our servers for advertising.' },
              { icon: '📤', title: 'You own your data', body: 'Export or delete everything instantly.' },
            ].map((f) => (
              <div key={f.title} className="rounded-2xl border border-slate-200 p-6">
                <span className="text-2xl">{f.icon}</span>
                <p className="mt-3 font-display text-base font-semibold text-ink">{f.title}</p>
                <p className="mt-1 text-sm text-slate-500">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI advisor showcase */}
      <section className="bg-beacon/15 py-24">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="font-display text-4xl font-semibold leading-tight text-ink">
              Ask anything about your visa
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-slate-700">
              {APP_NAME} knows your actual program dates, STEM status, and CPT history — so every
              answer is personal.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-block rounded-xl bg-beacon px-6 py-3 text-sm font-semibold text-ink shadow-sm transition hover:bg-beacon-600"
            >
              Try the AI Advisor →
            </Link>
          </div>
          <div className="rounded-2xl border border-beacon/30 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-beacon text-[10px] font-bold text-ink">W</span>
              {APP_NAME} Advisor
            </div>
            <p className="mt-3 min-h-[3lh] font-display text-lg text-ink">
              <Typewriter words={ADVISOR_QUESTIONS} />
            </p>
          </div>
        </div>
      </section>

      {/* waitlist */}
      <section className="bg-white py-20">
        <div className="mx-auto max-w-lg px-6 text-center">
          <h2 className="font-display text-3xl font-semibold text-ink">
            Join international students who never miss a deadline
          </h2>
          <div className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
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
                  {state === 'busy' ? 'Joining…' : 'Get started free'}
                </button>
              </>
            )}
          </div>
          {state === 'error' && <p className="mt-2 text-sm text-red-600">Something went wrong — try again.</p>}
          <p className="mt-3 text-xs text-slate-400">No credit card. No subscription. Free to start.</p>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="font-display text-lg font-semibold text-ink">{APP_NAME}</span>
            <p className="max-w-md text-xs text-slate-400">
              {APP_NAME} is informational only and not a substitute for legal advice. Always confirm
              immigration matters with your Designated School Official (DSO).
            </p>
          </div>
          <div className="mt-4 flex justify-center gap-4 text-xs text-slate-500">
            <Link href="/privacy" className="hover:text-ink">Privacy</Link>
            <Link href="/terms" className="hover:text-ink">Terms</Link>
            <Link href="/login" className="hover:text-ink">Contact</Link>
          </div>
          <p className="mt-4 text-center text-xs text-slate-400">Built for F-1 students by someone who lived it.</p>
        </div>
      </footer>
    </div>
  );
}
