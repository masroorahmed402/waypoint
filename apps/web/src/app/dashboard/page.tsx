'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import Onboarding from '@/components/onboarding';
import ArrivalChecklist from '@/components/arrival-checklist';
import { Card } from '@/components/ui';

interface Deadline { id: string; title: string; dueDate: string; type: string; source: string }
interface CptOptRecord { type: string; startDate: string; endDate: string; employerName: string | null }
interface CptSummary { records: CptOptRecord[] }
interface DsoContact { name: string; title: string | null; schoolName: string | null }

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

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
            <span>{i.earned ? '✓' : '○'} {i.label}{i.disabled ? ' (coming soon)' : ''}</span>
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

export default function Dashboard() {
  return <AppShell><DashboardInner /></AppShell>;
}

function DashboardInner() {
  const { me } = useAuth();
  const hasProfile = !!me?.profile;

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
    queryFn: () => api<{ id: string }[]>('/documents'),
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

  if (!hasProfile) return <Onboarding />;

  const now = new Date();
  const activeCpt = cpt.data?.records.find(
    (r) => r.type === 'CPT' && new Date(r.startDate) <= now && new Date(r.endDate) >= now,
  );

  const next = deadlines.data?.slice(0, 5) ?? [];
  const pipeline = apps.data?.data ?? [];
  const byStage = pipeline.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1; return acc;
  }, {});

  const setupSteps = [
    { done: true, label: 'Profile & timeline set up' },
    { done: (docs.data?.length ?? 0) > 0, label: 'Upload a document', href: '/documents' },
    { done: pipeline.length > 0, label: 'Track your first application', href: '/applications' },
  ];
  const doneCount = setupSteps.filter((s) => s.done).length;
  const urgentCount = next.filter((d) => daysUntil(d.dueDate) <= 7).length;

  const scoreItems: ScoreItem[] = [
    { label: 'Profile filled in', points: 25, earned: hasProfile, href: '/settings' },
    { label: 'I-20 uploaded', points: 20, earned: (docs.data?.length ?? 0) > 0, href: '/documents' },
    { label: 'At least 1 document', points: 15, earned: (docs.data?.length ?? 0) > 0, href: '/documents' },
    { label: 'At least 1 job application', points: 15, earned: pipeline.length > 0, href: '/applications' },
    { label: 'SEVIS ID stored', points: 10, earned: !!(me!.profile as any)?.sevisIdEncrypted, href: '/documents' },
    { label: 'DSO contact saved', points: 10, earned: !!dso.data, href: '/immigration' },
    { label: 'Push notifications enabled', points: 5, earned: false, disabled: true },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Hi {me!.firstName}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>
              {me!.profile!.major}
              {(me!.profile!.university?.name ?? me!.profile!.universityName) &&
                ` · ${me!.profile!.university?.name ?? me!.profile!.universityName}`}
            </span>
            {me!.profile!.stemEligible && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                STEM
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 sm:items-end">
          <Link
            href="/advisor"
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700"
          >
            Ask AI
          </Link>
          {doneCount < setupSteps.length && (
            <div className="w-full max-w-xs">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Getting set up</span>
                <span>{doneCount}/{setupSteps.length}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-beacon transition-all"
                  style={{ width: `${(doneCount / setupSteps.length) * 100}%` }}
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {setupSteps.filter((s) => !s.done).map((s) => (
                  <Link key={s.label} href={s.href ?? '#'} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-200">
                    {s.label} →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {activeCpt && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Active CPT{activeCpt.employerName ? ` at ${activeCpt.employerName}` : ''} — expires in {daysUntil(activeCpt.endDate)} days.
        </div>
      )}

      {(docs.data?.length ?? 0) === 0 && (
        <Card className="flex flex-col items-center gap-2 border-dashed py-6 text-center">
          <p className="text-sm font-medium text-ink">Upload your I-20 to unlock your full timeline and auto-fill your dates.</p>
          <Link href="/documents" className="text-sm font-medium text-ink underline">Upload now →</Link>
        </Card>
      )}

      <ArrivalChecklist programStartDate={me!.profile!.programStartDate} />

      <ProfileStrength items={scoreItems} />

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-display font-semibold text-ink">Next deadlines</h2>
              {urgentCount > 0 && (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-700">
                  {urgentCount} urgent
                </span>
              )}
            </div>
            <Link href="/immigration" className="text-sm font-medium text-ink hover:underline">View all</Link>
          </div>
          <div className="mt-4 space-y-1">
            {deadlines.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
            {next.length === 0 && !deadlines.isLoading && (
              <p className="text-sm text-slate-400">
                No upcoming deadlines. Complete onboarding to generate your timeline.{' '}
                <Link href="/immigration" className="text-ink underline">View immigration</Link>
              </p>
            )}
            {next.map((d) => {
              const n = daysUntil(d.dueDate);
              const urgency = n <= 7 ? 'bg-red-500' : n <= 30 ? 'bg-amber-500' : 'bg-slate-300';
              const textColor = n <= 7 ? 'text-red-600' : n <= 30 ? 'text-amber-600' : 'text-slate-500';
              return (
                <div key={d.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:bg-slate-50">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${urgency}`} />
                  <span className="flex-1 text-sm text-ink">{d.title}</span>
                  <span className={`text-sm font-semibold ${textColor}`}>
                    {n < 0 ? 'overdue' : n === 0 ? 'today' : `${n}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

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
            <div className="mt-4 grid grid-cols-3 gap-3">
              {Object.keys(STAGE_LABEL).map((s) => (
                <div key={s} className="rounded-lg bg-slate-50 p-3 text-center">
                  <div className="font-display text-2xl font-semibold text-ink">{byStage[s] ?? 0}</div>
                  <div className="text-xs text-slate-500">{STAGE_LABEL[s]}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
