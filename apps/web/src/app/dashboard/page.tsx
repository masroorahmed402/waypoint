'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import Onboarding from '@/components/onboarding';
import { Card } from '@/components/ui';

interface Deadline { id: string; title: string; dueDate: string; type: string; source: string }
interface CptOptRecord { type: string; startDate: string; endDate: string; employerName: string | null }
interface CptSummary { records: CptOptRecord[] }

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink">Hi {me!.firstName}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {me!.profile!.major}
            {(me!.profile!.university?.name ?? me!.profile!.universityName) &&
              ` · ${me!.profile!.university?.name ?? me!.profile!.universityName}`}
          </p>
        </div>
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

      {activeCpt && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Active CPT{activeCpt.employerName ? ` at ${activeCpt.employerName}` : ''} — expires in {daysUntil(activeCpt.endDate)} days.
        </div>
      )}

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
