'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';
import { joinWaitlist } from '@/lib/waitlist';
import { track } from '@/lib/posthog';
import RevealOnScroll from '@/components/reveal-on-scroll';

const PAIN_POINTS = [
  {
    icon: '⏰',
    body: 'OPT filing window is 150 days. Miss it by one day and you lose the right to work in your field.',
  },
  {
    icon: '✈️',
    body: 'Your I-20 travel signature expires every 12 months. Border agents turn students away every year.',
  },
  {
    icon: '📋',
    body: '12 months of full-time CPT wipes out your OPT eligibility entirely. Most students don’t track it.',
  },
];

const HOW_IT_WORKS = [
  {
    label: 'Step 1 of 3',
    heading: 'Upload your I-20 — we read it so you don’t have to',
    body: 'Drop in your PDF. Waypoint AI extracts your program dates, SEVIS ID, DSO contact, STEM eligibility, and CPT/OPT history automatically. Your document is encrypted immediately — AES-256, private to your account only.',
    note: '🔒 Encrypted on upload · Never shared · Delete anytime',
  },
  {
    label: 'Step 2 of 3',
    heading: 'Your entire F-1 journey, mapped to your exact dates',
    body: 'Not generic USCIS text. Your actual OPT window based on your program end date. Your actual CPT eligibility based on your enrollment start. Every milestone explained in plain English with the official USCIS source.',
    note: 'Informational only — always confirm important dates with your DSO',
  },
  {
    label: 'Step 3 of 3',
    heading: 'Email reminders and an AI advisor that knows your situation',
    body: 'Automatic reminders at 90, 30, 7, and 1 day before every deadline. An AI advisor that answers based on YOUR program dates, not generic FAQ text. Draft DSO emails. Track your USCIS case. Everything in one place.',
    note: null,
  },
];

const FEATURES = [
  { icon: '📄', title: 'I-20 Intelligence', body: 'Extracts program dates, SEVIS ID, DSO contact, STEM eligibility, and CPT/OPT authorization automatically from your PDF.' },
  { icon: '⏰', title: 'Deadline Guardian', body: 'Reminders at 90, 30, 7, and 1 day before OPT filing deadline, visa expiry, I-20 expiry, travel signatures, and more.' },
  { icon: '🤖', title: 'AI Advisor', body: 'Ask anything. Answers based on your actual program dates and CPT history — not generic FAQ text. Powered by Llama 3.3.' },
  { icon: '📁', title: 'Document Vault', body: 'Store your I-20, passport, visa stamp, EAD, and insurance securely. Expiry alerts auto-generate from uploaded documents.' },
  { icon: '💼', title: 'Job Tracker with H-1B Data', body: 'Track applications with real H-1B sponsorship history from public DOL data. Know before you apply.' },
  { icon: '🎓', title: 'STEM OPT Detection', body: 'Auto-detects STEM-designated CIP codes from your I-20. Tracks your 24-month extension eligibility.' },
  { icon: '📊', title: 'USCIS Case Tracker', body: 'Add your receipt number. Get notified the moment your OPT or EAD status changes — no more manual checking.' },
  { icon: '🏥', title: 'Arrival Checklist', body: 'SSN application, driver’s license, bank account, health insurance — a step-by-step guide for every new student.' },
  { icon: '📧', title: 'DSO Email Drafter', body: 'AI writes professional emails to your DSO pre-filled with your SEVIS ID, program dates, and situation.' },
];

const TRUST_COLUMNS = [
  {
    icon: '🔐',
    title: 'AES-256-GCM Encryption',
    body: 'Every document, SEVIS ID, and passport number is encrypted the moment it leaves your browser. The same standard used by banks and healthcare systems. Even we cannot read your raw SEVIS ID.',
  },
  {
    icon: '🚫',
    title: 'Zero Data Sharing',
    body: 'Your documents are never used for advertising, never sold, never shared with third parties. The only external service that receives any text about you is our AI provider — and only your profile summary, never your documents.',
  },
  {
    icon: '🗑️',
    title: 'You Own Everything',
    body: 'Delete any document instantly. Delete your account and everything disappears from our servers within 24 hours — files from storage, data from the database, all of it.',
  },
];

const STATS = [
  { stat: '150 days', label: 'OPT filing window we track for you' },
  { stat: '90 days', label: 'Earliest warning before your deadline' },
  { stat: '24 months', label: 'STEM OPT extension we detect automatically' },
  { stat: '$0', label: 'Cost to start' },
];

const ADVISOR_MESSAGES = [
  { role: 'user' as const, text: 'Am I eligible for OPT?' },
  {
    role: 'ai' as const,
    text: 'Yes. Your program ends June 11, 2027 — your OPT filing window opens March 13, 2027 (90 days before). You’ve used 3 months of full-time CPT at Fynite AI, so your 12-month OPT is fully intact. Talk to your DSO around February 2027 to start the process.',
  },
  { role: 'user' as const, text: 'What if I want to start working before graduation?' },
  {
    role: 'ai' as const,
    text: 'You may be eligible for Pre-completion OPT since you’re in your final year. It’s part-time only (max 20 hrs/week while enrolled) and counts against your 12-month total. Your DSO can issue the I-20 recommendation — worth discussing now.',
  },
];

const TIMELINE_MILESTONES = ['Arrived', 'Program Start', 'CPT Eligible', 'OPT Window Opens', 'Program End', 'Grace Period'];

function HeroMockup() {
  return (
    <div className="relative mx-auto max-w-sm animate-float" style={{ animationDuration: '6s' }}>
      <div
        className="rounded-2xl border border-white/10 bg-ink-700 p-5"
        style={{ boxShadow: '0 0 60px rgba(230,165,58,0.15)' }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/40">Your F-1 timeline</p>
        <div className="mt-4 flex items-center justify-between">
          {['Arrival', 'CPT', 'OPT', 'Grace'].map((label, i) => (
            <div key={label} className="flex flex-1 flex-col items-center">
              <span
                className={`h-2.5 w-2.5 rounded-full ${i === 2 ? 'animate-pulse-beacon bg-beacon' : 'bg-white/25'}`}
              />
              <span className="mt-2 text-[10px] text-white/50">{label}</span>
            </div>
          ))}
          <div className="absolute left-9 right-9 top-[74px] -z-0 h-px bg-white/15" />
        </div>

        <div className="relative mt-5 rounded-xl border border-beacon/30 bg-ink px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-wide text-beacon">Next deadline</p>
          <p className="mt-1 text-sm font-semibold text-paper">OPT window opens in 47 days</p>
        </div>

        <div className="mt-4 space-y-2">
          <div className="ml-auto max-w-[85%] rounded-xl rounded-br-sm bg-white/10 px-3 py-2 text-xs text-paper">
            Am I eligible for OPT?
          </div>
          <div className="max-w-[90%] rounded-xl rounded-bl-sm border border-beacon/20 bg-beacon/10 px-3 py-2 text-xs text-paper">
            Yes — your window opens March 13, 2027
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadIllustration() {
  const chips = ['SEVIS ID', 'Program dates', 'School name', 'STEM badge'];
  return (
    <div className="relative flex h-72 items-center justify-center">
      <div className="relative flex h-40 w-32 flex-col items-center justify-center rounded-lg border-2 border-dashed border-beacon/50 bg-beacon/5">
        <div className="rounded-md bg-ink px-3 py-4 text-center shadow-sm">
          <p className="text-[10px] font-semibold text-paper">Form I-20</p>
          <div className="mx-auto mt-2 h-1 w-10 rounded bg-white/20" />
          <div className="mx-auto mt-1.5 h-1 w-8 rounded bg-white/20" />
        </div>
        <p className="mt-2 text-[10px] font-medium text-beacon-600">drop to upload</p>
      </div>
      {chips.map((chip, i) => (
        <span
          key={chip}
          className="animate-fade-up absolute rounded-full border border-beacon/30 bg-white px-2.5 py-1 text-[10px] font-medium text-ink shadow-sm"
          style={{
            top: `${18 + i * 16}%`,
            left: i % 2 === 0 ? '68%' : '4%',
            animationDelay: `${0.3 + i * 0.25}s`,
          }}
        >
          {chip}
        </span>
      ))}
    </div>
  );
}

function TimelineIllustration() {
  return (
    <div className="flex h-72 flex-col justify-center gap-4 px-4">
      {TIMELINE_MILESTONES.map((label, i) => (
        <div
          key={label}
          className="animate-fade-up flex items-center gap-3"
          style={{ animationDelay: `${i * 0.35}s` }}
        >
          <span
            className={`h-3 w-3 shrink-0 rounded-full ${
              i === 3 ? 'animate-pulse-beacon bg-beacon' : 'border-2 border-slate-300 bg-white'
            }`}
          />
          <span className={`text-sm ${i === 3 ? 'font-semibold text-ink' : 'text-slate-500'}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function ReminderIllustration() {
  return (
    <div className="flex h-72 flex-col justify-center gap-3 px-2">
      <div className="animate-fade-up rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-beacon text-xs">🔔</span>
          <div>
            <p className="text-xs font-semibold text-ink">OPT window opens in 30 days</p>
            <p className="text-[10px] text-slate-400">{APP_NAME}</p>
          </div>
        </div>
      </div>
      <div className="animate-fade-up ml-auto max-w-[85%] rounded-2xl rounded-br-sm bg-ink px-3 py-2 text-xs text-white" style={{ animationDelay: '0.4s' }}>
        What do I need to bring to my DSO meeting?
      </div>
      <div className="animate-fade-up max-w-[90%] rounded-2xl rounded-bl-sm border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700" style={{ animationDelay: '0.8s' }}>
        Bring your passport, current I-20, and your most recent transcript. Confirm the exact list with your DSO before the meeting.
      </div>
    </div>
  );
}

function HowItWorksDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setStep((s) => (s + 1) % HOW_IT_WORKS.length), 4000);
    return () => clearInterval(interval);
  }, [step]);

  const current = HOW_IT_WORKS[step];

  return (
    <div>
      <div className="mx-auto flex max-w-xl gap-2">
        {HOW_IT_WORKS.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to step ${i + 1}`}
            onClick={() => setStep(i)}
            className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200"
          >
            <span
              key={`${i}-${step}`}
              className="block h-full rounded-full bg-beacon"
              style={{
                width: i < step ? '100%' : i > step ? '0%' : undefined,
                animation: i === step ? 'fillBar 4s linear forwards' : undefined,
              }}
            />
          </button>
        ))}
      </div>

      <div className="mt-10 grid items-center gap-10 sm:grid-cols-2">
        <div key={`illustration-${step}`} className="animate-fade-in rounded-2xl border border-slate-200 bg-paper">
          {step === 0 && <UploadIllustration />}
          {step === 1 && <TimelineIllustration />}
          {step === 2 && <ReminderIllustration />}
        </div>
        <div key={`text-${step}`} className="animate-fade-in">
          <p className="text-xs font-semibold uppercase tracking-wide text-beacon-600">{current.label}</p>
          <h3 className="mt-2 font-display text-2xl font-semibold text-ink">{current.heading}</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{current.body}</p>
          {current.note && <p className="mt-4 text-xs font-medium text-slate-400">{current.note}</p>}
        </div>
      </div>
    </div>
  );
}

function AdvisorChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisibleCount(1);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (visibleCount === 0 || visibleCount > ADVISOR_MESSAGES.length) return;
    const timeout = setTimeout(() => {
      setVisibleCount((c) => (c >= ADVISOR_MESSAGES.length ? 1 : c + 1));
    }, visibleCount >= ADVISOR_MESSAGES.length ? 3200 : 1400);
    return () => clearTimeout(timeout);
  }, [visibleCount]);

  return (
    <div ref={ref} className="rounded-2xl bg-ink p-6 shadow-lg">
      <div className="flex items-center gap-2 text-xs font-medium text-white/50">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-beacon text-[10px] font-bold text-ink">W</span>
        {APP_NAME} Advisor
      </div>
      <div className="mt-4 min-h-[220px] space-y-3">
        {ADVISOR_MESSAGES.slice(0, visibleCount).map((m, i) => (
          <div
            key={i}
            className={`animate-fade-up max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              m.role === 'user'
                ? 'ml-auto rounded-br-sm bg-white/10 text-white'
                : 'rounded-bl-sm border border-beacon/25 bg-beacon/10 text-paper'
            }`}
          >
            {m.text}
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-white/40">Not legal advice — always confirm with your DSO</p>
    </div>
  );
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  async function submit() {
    if (!email) return;
    setState('busy');
    try {
      await joinWaitlist(email);
      track('waitlist_joined');
      setState('done');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <style>{`@keyframes fillBar { from { width: 0%; } to { width: 100%; } }`}</style>

      {/* nav */}
      <header className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <span className="font-display text-xl font-semibold text-paper">{APP_NAME}</span>
        </span>
        <div className="flex items-center gap-3 text-sm">
          <Link href="/login" className="text-white/70 hover:text-white">Log in</Link>
          <Link href="/register" className="rounded-lg bg-beacon px-4 py-2 font-medium text-ink transition hover:bg-beacon-600">
            Get started
          </Link>
        </div>
      </header>

      {/* Section 1 — Hero */}
      <section className="relative flex min-h-screen items-center overflow-hidden bg-ink">
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-6 py-28 sm:grid-cols-5 sm:items-center">
          <div className="sm:col-span-3">
            <p className="mb-6 inline-block rounded-full border border-beacon/30 bg-beacon/10 px-3 py-1 text-xs font-semibold tracking-wide text-beacon">
              Built for F-1 students — not for everyone
            </p>
            <h1 className="font-display text-4xl font-semibold leading-[1.15] tracking-tight text-paper sm:text-5xl">
              You&apos;re one missed deadline away from losing your visa status.
              <br />
              {APP_NAME} makes sure that never happens.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-white/70 sm:text-lg">
              Upload your I-20. Get your personal F-1 timeline, automated deadline reminders, an AI
              advisor that knows your actual program dates — and everything else an international
              student needs to stay in status from day one to graduation.
            </p>

            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
              <Link
                href="/register"
                className="w-full whitespace-nowrap rounded-xl bg-beacon px-8 py-3.5 text-base font-semibold text-ink shadow-sm transition hover:bg-beacon-600 sm:w-auto"
              >
                Build my F-1 timeline →
              </Link>
              <a
                href="#how-it-works"
                className="w-full whitespace-nowrap rounded-xl border border-white/30 px-8 py-3.5 text-center text-base font-medium text-paper transition hover:bg-white/10 sm:w-auto"
              >
                See how it works
              </a>
            </div>

            <p className="mt-6 text-xs text-white/40">
              Used by F-1 students at DePaul, UIUC, Northeastern, NYU, Purdue · Free to start
            </p>
          </div>

          <div className="hidden sm:col-span-2 sm:block">
            <HeroMockup />
          </div>
        </div>
      </section>

      {/* Section 2 — The real problem */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mx-auto max-w-3xl text-center font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            International students track 40+ deadlines across 6 different government websites.
            <br />
            Most students find out they missed something after it&apos;s too late.
          </h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-3">
            {PAIN_POINTS.map((p, i) => (
              <RevealOnScroll key={p.body} delay={i * 120}>
                <div className="h-full rounded-2xl border border-slate-200 bg-paper p-6">
                  <span className="text-2xl">{p.icon}</span>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">{p.body}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
          <p className="mt-10 text-center text-sm font-semibold text-beacon-600">
            {APP_NAME} tracks all of it — automatically, from your I-20.
          </p>
        </div>
      </section>

      {/* Section 3 — How it works */}
      <section id="how-it-works" className="bg-paper py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-ink sm:text-4xl">
            From I-20 to full timeline in 60 seconds
          </h2>
          <div className="mt-12">
            <HowItWorksDemo />
          </div>
          <div className="mt-14 text-center">
            <Link
              href="/register"
              className="inline-block rounded-xl bg-beacon px-8 py-3.5 text-base font-semibold text-ink shadow-sm transition hover:bg-beacon-600"
            >
              Build my F-1 timeline →
            </Link>
          </div>
        </div>
      </section>

      {/* Section 4 — Feature grid */}
      <section className="bg-ink py-24">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="text-center font-display text-3xl font-semibold text-paper sm:text-4xl">
            Everything an F-1 student needs — nothing you don&apos;t
          </h2>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <RevealOnScroll key={f.title} delay={(i % 3) * 100}>
                <div className="h-full rounded-2xl bg-white p-5 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                  <span className="text-2xl">{f.icon}</span>
                  <h3 className="mt-3 font-display text-lg font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              </RevealOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — AI advisor showcase */}
      <section className="bg-beacon py-24">
        <div className="mx-auto grid max-w-5xl gap-10 px-6 sm:grid-cols-2 sm:items-center">
          <div>
            <h2 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
              An immigration advisor
              <br />
              that actually knows you.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-ink/80">
              Generic chatbots give generic answers. {APP_NAME} knows your program end date, your CPT
              history, your STEM status, and your DSO&apos;s name.
              <br />
              <br />
              So when you ask &quot;Am I eligible for OPT?&quot; you don&apos;t get a USCIS FAQ. You get an
              answer about you.
            </p>
            <Link
              href="/register"
              className="mt-7 inline-block rounded-xl bg-ink px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-ink-700"
            >
              Try the AI Advisor →
            </Link>
          </div>
          <AdvisorChatDemo />
        </div>
      </section>

      {/* Section 6 — Security */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Your immigration documents deserve bank-level security. That&apos;s what you get.
          </h2>
          <div className="mt-14 grid gap-6 text-left sm:grid-cols-3">
            {TRUST_COLUMNS.map((t) => (
              <div key={t.title} className="rounded-2xl border border-slate-200 p-6">
                <span className="text-2xl">{t.icon}</span>
                <p className="mt-3 font-display text-base font-semibold text-ink">{t.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t.body}</p>
              </div>
            ))}
          </div>
          <Link href="/security" className="mt-10 inline-block text-sm font-medium text-slate-500 hover:text-ink">
            Read our full security policy →
          </Link>
        </div>
      </section>

      {/* Section 7 — Stats */}
      <section className="bg-ink py-16">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid grid-cols-2 gap-8 text-center sm:grid-cols-4">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-display text-3xl font-semibold text-beacon sm:text-4xl">{s.stat}</div>
                <div className="mt-2 text-xs leading-snug text-white/60">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 8 — Final CTA */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-lg px-6 text-center">
          <h2 className="font-display text-3xl font-semibold leading-tight text-ink sm:text-4xl">
            Your I-20 is sitting in a folder somewhere.
            <br />
            It should be running your life instead.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-slate-600">
            Upload it. See your timeline in 60 seconds. Get reminders. Ask the AI anything.
            <br />
            Free to start — no credit card.
          </p>

          <div className="mx-auto mt-8 flex max-w-md flex-col gap-2 sm:flex-row">
            {state === 'done' ? (
              <div className="w-full rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
                You&apos;re on the list, we&apos;ll be in touch. In the meantime, you can{' '}
                <Link href="/register" className="font-medium underline">create your account now</Link>.
              </div>
            ) : (
              <>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="you@university.edu"
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm shadow-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
                />
                <button
                  onClick={submit}
                  disabled={state === 'busy'}
                  className="whitespace-nowrap rounded-xl bg-beacon px-6 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-beacon-600 disabled:opacity-50"
                >
                  {state === 'busy' ? 'Joining…' : 'Build my F-1 timeline →'}
                </button>
              </>
            )}
          </div>
          {state === 'error' && <p className="mt-2 text-sm text-red-600">Something went wrong, try again.</p>}
          <p className="mt-4 text-xs text-slate-400">Joining 100+ F-1 students managing their immigration with {APP_NAME}</p>
        </div>
      </section>

      {/* Section 9 — Footer */}
      <footer className="bg-ink-900">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div className="text-center sm:text-left">
              <span className="font-display text-lg font-semibold text-paper">{APP_NAME}</span>
              <p className="mt-1 text-xs text-white/40">F-1 immigration, organized.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/60">
              <Link href="/dashboard" className="hover:text-white">Dashboard</Link>
              <Link href="/immigration" className="hover:text-white">Immigration</Link>
              <Link href="/advisor" className="hover:text-white">AI Advisor</Link>
              <Link href="/documents" className="hover:text-white">Documents</Link>
              <Link href="/applications" className="hover:text-white">Applications</Link>
            </div>
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-white/60">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/security" className="hover:text-white">Security</Link>
              <a href="mailto:support@waypoint.app" className="hover:text-white">Contact</a>
            </div>
          </div>
          <p className="mt-10 text-center text-xs leading-relaxed text-white/30">
            {APP_NAME} is informational only and not a substitute for advice from your DSO, SEVP, USCIS, or a
            qualified immigration attorney.
          </p>
        </div>
      </footer>
    </div>
  );
}
