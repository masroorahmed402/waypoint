'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/app-shell';
import Onboarding from '@/components/onboarding';
import ArrivalChecklist from '@/components/arrival-checklist';
import { Card, Skeleton, Disclaimer } from '@/components/ui';
import { hasUsedAdvisor, hasDraftedDsoEmail, getGreeting, recordCheckIn } from '@/lib/engagement';
import { formatDeadline, formatDate } from '@/lib/format-date';
import { showToast } from '@/lib/toast';

interface Deadline { id: string; title: string; dueDate: string; type: string; source: string }
interface CptOptRecord { type: string; startDate: string; endDate: string; employerName: string | null }
interface CptSummary { records: CptOptRecord[]; fullTimeMonthsUsed: number }
interface DsoContact { name: string; title: string | null; schoolName: string | null }
interface OptUnemploymentSummary { daysUsed: number; daysRemaining: number; limit: number; warning: string | null }

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const SUGGESTED_QUESTIONS = [
  'Am I eligible for OPT?',
  'How much CPT have I used?',
  'What happens during the 60-day grace period?',
];

interface ScoreItem { label: string; points: number; earned: boolean; href?: string; disabled?: boolean }

function ProfileStrength({ items }: { items: ScoreItem[] }) {
  const max = items.reduce((s, i) => s + (i.disabled ? 0 : i.points), 0);
  const score = items.reduce((s, i) => s + (i.earned ? i.points : 0), 0);
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const r = 26;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  const nextUp = items
    .filter((i) => !i.earned && !i.disabled && i.href)
    .sort((a, b) => b.points - a.points)[0];

  return (
    <Card>
      <h2 className="font-display font-semibold text-ink">Profile strength</h2>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative h-16 w-16 shrink-0">
          <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
            <circle cx="32" cy="32" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
            <circle
              cx="32" cy="32" r={r} fill="none" stroke="#059669" strokeWidth="6" strokeLinecap="round"
              strokeDasharray={circumference} strokeDashoffset={offset}
              className="transition-all"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-lg font-semibold text-ink">{pct}</span>
          </div>
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-500">{score}/{max} points</p>
          {nextUp ? (
            <Link href={nextUp.href!} className="mt-1 inline-block text-sm font-medium text-ink underline">
              Do this next: {nextUp.label} (+{nextUp.points})
            </Link>
          ) : (
            <p className="mt-1 text-sm text-emerald-700">Your profile is fully set up 🎉</p>
          )}
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {items.map((i) => (
          <div key={i.label} className={`flex items-center justify-between text-xs ${i.disabled ? 'text-slate-300' : i.earned ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span>{i.earned ? '✓' : '○'} {i.label}</span>
            <span>{i.points}pt</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

const STAGE_LABEL: Record<string, string> = {
  SAVED: 'Saved', APPLIED: 'Applied', OA: 'OA', INTERVIEW: 'Interview', OFFER: 'Offer', REJECTED: 'Rejected',
};
const STAGE_ORDER = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER'];

export default function Dashboard() {
  return <AppShell><DashboardInner /></AppShell>;
}

function DashboardInner() {
  const { me } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();
  const hasProfile = !!me?.profile;
  const [question, setQuestion] = useState('');
  const [streak, setStreak] = useState(0);

  useEffect(() => { if (me?.id) setStreak(recordCheckIn(me.id)); }, [me?.id]);

  const deadlines = useQuery({
    queryKey: ['deadlines', 'upcoming'],
    queryFn: () => api<Deadline[]>('/immigration/deadlines?status=upcoming'),
    enabled: hasProfile,
  });

  const apps = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<{ data: { id: string; stage: string }[] }>('/career/applications'),
    enabled: hasProfile,
  });

  const docs = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<{ id: string; type: string }[]>('/documents'),
    enabled: hasProfile,
  });

  const cpt = useQuery({
    queryKey: ['cpt-summary'],
    queryFn: () => api<CptSummary>('/immigration/cpt-summary'),
    enabled: hasProfile,
  });

  const dso = useQuery({
    queryKey: ['dso-contact'],
    queryFn: () => api<DsoContact | null>('/immigration/dso-contact'),
    enabled: hasProfile,
  });

  const optUnemployment = useQuery({
    queryKey: ['opt-unemployment-summary'],
    queryFn: () => api<OptUnemploymentSummary>('/immigration/opt-unemployment/summary'),
    enabled: hasProfile,
  });
  const logUnemployment = useMutation({
    mutationFn: () => api('/immigration/opt-unemployment/start', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opt-unemployment-summary'] }),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => api(`/immigration/deadlines/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ dismissedAt: new Date().toISOString() }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deadlines'] });
      showToast('Got it, we won’t remind you about this one');
    },
  });

  function askAdvisor() {
    if (!question.trim()) return;
    router.push(`/advisor?q=${encodeURIComponent(question)}`);
  }

  if (!hasProfile) return <Onboarding />;

  const now = new Date();
  const activeCpt = cpt.data?.records.find(
    (r) => r.type === 'CPT' && new Date(r.startDate) <= now && new Date(r.endDate) >= now,
  );

  const next = deadlines.data?.slice(0, 6) ?? [];
  const pipeline = apps.data?.data ?? [];
  const byStage = pipeline.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1; return acc;
  }, {});

  const hasPassport = (docs.data ?? []).some((d) => d.type === 'PASSPORT');
  const programEnd = new Date(me!.profile!.programEndDate);
  const daysToProgramEnd = daysUntil(me!.profile!.programEndDate);
  const monthsToProgramEnd = Math.round(daysToProgramEnd / 30);
  const optWindowOpen = new Date(programEnd.getTime() - 90 * 86_400_000);
  const cptMonthsUsed = cpt.data?.fullTimeMonthsUsed ?? 0;

  const scoreItems: ScoreItem[] = [
    { label: 'Profile filled in', points: 25, earned: hasProfile, href: '/settings' },
    { label: 'I-20 uploaded', points: 20, earned: (docs.data?.length ?? 0) > 0, href: '/documents' },
    { label: 'At least 1 document', points: 15, earned: (docs.data?.length ?? 0) > 0, href: '/documents' },
    { label: 'At least 1 job application', points: 15, earned: pipeline.length > 0, href: '/applications' },
    { label: 'SEVIS ID stored', points: 10, earned: !!(me!.profile as any)?.sevisIdEncrypted, href: '/documents' },
    { label: 'DSO contact saved', points: 10, earned: !!dso.data, href: '/immigration' },
    { label: 'Latest U.S. arrival date set', points: 5, earned: !!me!.profile!.usEntryDate, href: '/settings' },
    { label: 'Asked the AI advisor a question', points: 5, earned: hasUsedAdvisor(me!.id), href: '/advisor' },
    { label: 'DSO email drafted', points: 5, earned: hasDraftedDsoEmail(me!.id), href: '/immigration' },
  ];

  const recommendations = [
    !hasPassport && {
      icon: '🛂', title: 'Upload your passport', href: '/documents',
      description: 'Keep a secure copy on hand and get expiry reminders before it lapses.',
    },
    monthsToProgramEnd <= 18 && monthsToProgramEnd > 0 && {
      icon: '🎓', title: 'Check your OPT eligibility', href: '/advisor',
      description: `Your program ends in about ${monthsToProgramEnd} months, ask the advisor when your OPT window opens.`,
    },
    pipeline.length === 0 && {
      icon: '💼', title: 'Add job applications', href: '/applications',
      description: 'Track applications and see H-1B sponsorship history before you apply.',
    },
  ].filter((r): r is { icon: string; title: string; href: string; description: string } => !!r).slice(0, 3);

  const programEndColor = daysToProgramEnd > 365 ? 'text-emerald-600' : daysToProgramEnd > 90 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="space-y-6">
      {/* AI advisor hero */}
      <div className="animate-fade-up overflow-hidden rounded-2xl bg-gradient-to-br from-beacon/30 via-beacon/15 to-white p-6 shadow-sm ring-1 ring-beacon/20 sm:p-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-beacon-600">
          {streak > 1 && <span>🔥 {streak}-day streak</span>}
        </div>
        <h1 className="mt-1 font-display text-2xl font-semibold text-ink sm:text-3xl">
          Good {getGreeting()}, {me!.firstName}. Your immigration advisor is ready.
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          You&apos;re {Math.max(0, Math.round((Date.now() - new Date(me!.profile!.programStartDate).getTime()) / 86_400_000))} days
          into your program at {me!.profile!.university?.name ?? me!.profile!.universityName ?? 'your university'}.
          {' '}Your OPT window opens {formatDate(optWindowOpen)}.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askAdvisor()}
            placeholder="Ask anything about your visa, OPT, CPT..."
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3.5 text-sm shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          />
          <button
            onClick={askAdvisor}
            className="whitespace-nowrap rounded-xl bg-beacon px-6 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-beacon-600"
          >
            Ask AI →
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => router.push(`/advisor?q=${encodeURIComponent(q)}`)}
              className="rounded-full border border-beacon/40 bg-white/70 px-3 py-1.5 text-xs text-ink transition hover:bg-white"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* status cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="animate-fade-up" style={{ animationDelay: '80ms' } as React.CSSProperties}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Days until program ends</p>
          <p className={`mt-1 font-display text-3xl font-semibold ${programEndColor}`}>
            {daysToProgramEnd > 0 ? daysToProgramEnd : 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(programEnd)}</p>
        </Card>
        <Card className="animate-fade-up" style={{ animationDelay: '160ms' } as React.CSSProperties}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">OPT window opens</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">{formatDeadline(optWindowOpen)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatDate(optWindowOpen)}</p>
        </Card>
        <Card className="animate-fade-up" style={{ animationDelay: '240ms' } as React.CSSProperties}>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">CPT used</p>
          <p className="mt-1 font-display text-3xl font-semibold text-ink">{cptMonthsUsed} <span className="text-base font-normal text-slate-400">/ 12 mo</span></p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all ${cptMonthsUsed >= 9 ? 'bg-red-500' : 'bg-beacon'}`}
              style={{ width: `${Math.min(100, (cptMonthsUsed / 12) * 100)}%` }}
            />
          </div>
        </Card>
      </div>

      {activeCpt?.type === 'OPT' && optUnemployment.data && (
        <Card>
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink">OPT job search: {optUnemployment.data.daysRemaining} days remaining</p>
            <Link href="/applications" className="text-xs font-medium text-ink underline">View applications →</Link>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full ${optUnemployment.data.daysUsed >= optUnemployment.data.limit - 15 ? 'bg-red-500' : optUnemployment.data.daysUsed >= optUnemployment.data.limit - 30 ? 'bg-amber-500' : 'bg-beacon'}`}
              style={{ width: `${Math.min(100, (optUnemployment.data.daysUsed / optUnemployment.data.limit) * 100)}%` }}
            />
          </div>
          {optUnemployment.data.warning && (
            <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">{optUnemployment.data.warning}</p>
          )}
          <button
            onClick={() => logUnemployment.mutate()}
            className="mt-2 text-xs font-medium text-slate-500 underline-offset-2 hover:underline"
          >
            Log an unemployment period
          </button>
        </Card>
      )}

      {(docs.data?.length ?? 0) === 0 && (
        <Card className="flex flex-col items-center gap-2 border-dashed py-6 text-center">
          <p className="text-sm font-medium text-ink">Upload your I-20 to unlock your full timeline and auto-fill your dates.</p>
          <Link href="/documents" className="text-sm font-medium text-ink underline">Upload now →</Link>
        </Card>
      )}

      {/* deadlines */}
      <div>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink">Next deadlines</h2>
          <Link href="/immigration" className="text-sm font-medium text-ink hover:underline">View all →</Link>
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {deadlines.isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
          {next.length === 0 && !deadlines.isLoading && (
            <p className="text-sm text-slate-400 sm:col-span-2">No upcoming deadlines.</p>
          )}
          {next.map((d) => {
            const n = daysUntil(d.dueDate);
            const border = n <= 7 ? 'border-red-300 bg-red-50' : n <= 30 ? 'border-amber-300 bg-amber-50' : 'border-emerald-200 bg-emerald-50/50';
            const textColor = n <= 7 ? 'text-red-600' : n <= 30 ? 'text-amber-600' : 'text-emerald-700';
            return (
              <div key={d.id} className={`flex items-center justify-between rounded-xl border px-4 py-3 ${border} ${n <= 7 ? 'animate-pulse-beacon' : ''}`}>
                <div>
                  <p className="text-sm font-medium text-ink">{d.title}</p>
                  <p className={`text-xs font-semibold ${textColor}`}>{formatDeadline(d.dueDate)}</p>
                </div>
                <button
                  onClick={() => dismiss.mutate(d.id)}
                  className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-white hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>
            );
          })}
        </div>
        <div className="mt-3">
          <Disclaimer />
        </div>
      </div>

      <ArrivalChecklist programStartDate={me!.profile!.programStartDate} />

      {recommendations.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-ink">Recommended next steps</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {recommendations.map((r) => (
              <Card key={r.title} className="flex flex-col gap-2">
                <span className="text-2xl">{r.icon}</span>
                <p className="text-sm font-medium text-ink">{r.title}</p>
                <p className="flex-1 text-xs text-slate-500">{r.description}</p>
                <Link href={r.href} className="text-sm font-medium text-ink underline">Go →</Link>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-display font-semibold text-ink">Application pipeline</h2>
            <Link href="/applications" className="text-sm font-medium text-ink hover:underline">Open board</Link>
          </div>
          {pipeline.length === 0 ? (
            <div className="mt-8 flex flex-col items-center text-center">
              <p className="text-sm text-slate-500">No applications tracked yet.</p>
              <Link href="/applications" className="mt-2 text-sm font-medium text-ink underline">Add your first one</Link>
            </div>
          ) : (
            <div className="mt-4 flex items-stretch gap-1.5">
              {STAGE_ORDER.map((s) => {
                const count = byStage[s] ?? 0;
                const width = Math.max(8, (count / pipeline.length) * 100);
                return (
                  <div key={s} className="flex-1 text-center">
                    <div className="flex h-16 items-end justify-center rounded-lg bg-slate-50 p-1">
                      <div
                        className="w-full rounded bg-ink transition-all"
                        style={{ height: `${width}%`, minHeight: count > 0 ? '10%' : '2px' }}
                      />
                    </div>
                    <div className="mt-1 font-display text-lg font-semibold text-ink">{count}</div>
                    <div className="text-xs text-slate-500">{STAGE_LABEL[s]}</div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <ProfileStrength items={scoreItems} />
      </div>
    </div>
  );
}
