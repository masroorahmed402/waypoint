'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import Onboarding from '@/components/onboarding';
import { Card } from '@/components/ui';

interface Deadline { id: string; title: string; dueDate: string; type: string; source: string }

function daysUntil(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

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

  if (!hasProfile) return <Onboarding />;

  const next = deadlines.data?.slice(0, 4) ?? [];
  const pipeline = apps.data?.data ?? [];
  const byStage = pipeline.reduce<Record<string, number>>((acc, a) => {
    acc[a.stage] = (acc[a.stage] ?? 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Hi {me!.firstName}</h1>
        <p className="text-sm text-slate-500">{me!.profile!.major} · {me!.profile!.university?.name ?? me!.profile!.universityName}</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Next deadlines</h2>
            <Link href="/immigration" className="text-sm text-ink">View all</Link>
          </div>
          <div className="mt-4 space-y-3">
            {deadlines.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
            {next.length === 0 && !deadlines.isLoading && (
              <p className="text-sm text-slate-400">
                No upcoming deadlines. Complete onboarding to generate your timeline.{' '}
                <Link href="/immigration" className="text-ink">View immigration</Link>
              </p>
            )}
            {next.map((d) => {
              const n = daysUntil(d.dueDate);
              return (
                <div key={d.id} className="flex items-center justify-between">
                  <span className="text-sm">{d.title}</span>
                  <span className={`text-sm font-medium ${n <= 7 ? 'text-red-600' : n <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                    {n < 0 ? 'overdue' : `${n}d`}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Application pipeline</h2>
            <Link href="/applications" className="text-sm text-ink">Open board</Link>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3">
            {['SAVED', 'APPLIED', 'INTERVIEW', 'OA', 'OFFER', 'REJECTED'].map((s) => (
              <div key={s} className="rounded-lg bg-slate-50 p-3 text-center">
                <div className="text-2xl font-semibold">{byStage[s] ?? 0}</div>
                <div className="text-xs text-slate-500">{s.toLowerCase()}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
