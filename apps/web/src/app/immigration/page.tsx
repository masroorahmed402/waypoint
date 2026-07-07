'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Card, Disclaimer } from '@/components/ui';

interface Milestone {
  key: string; label: string; date?: string;
  dateRange?: { start: string; end: string };
  status: 'PAST' | 'CURRENT' | 'UPCOMING';
  explanation: string; sourceUrl?: string;
}
interface Timeline { ruleVersion: string; disclaimer: string; milestones: Milestone[] }
interface Deadline { id: string; title: string; dueDate: string; type: string; source: string; notes?: string; dismissedAt?: string | null }

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function ImmigrationPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const tl = useQuery({ queryKey: ['timeline'], queryFn: () => api<Timeline>('/immigration/timeline') });
  const dl = useQuery({ queryKey: ['deadlines', 'all'], queryFn: () => api<Deadline[]>('/immigration/deadlines') });

  const dismiss = useMutation({
    mutationFn: (id: string) =>
      api(`/immigration/deadlines/${id}`, { method: 'PATCH', body: JSON.stringify({ dismissedAt: new Date().toISOString() }) }),
    onSuccess: (_data, id) => {
      qc.setQueryData<Deadline[]>(['deadlines', 'all'], (old) => old?.filter((d) => d.id !== id));
    },
  });

  if (tl.isError) {
    return <p className="text-sm text-slate-500">Complete onboarding on the dashboard first.</p>;
  }

  const dotColor = (s: Milestone['status']) =>
    s === 'PAST' ? 'bg-slate-300' : s === 'CURRENT' ? 'bg-ink ring-4 ring-ink/10' : 'bg-white border-2 border-slate-300';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Immigration</h1>
        {tl.data && <span className="text-xs text-slate-400">rules {tl.data.ruleVersion}</span>}
      </div>
      <Disclaimer />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="font-semibold">Your F-1 journey</h2>
          <ol className="mt-5 space-y-5">
            {tl.data?.milestones.map((m) => (
              <li key={m.key} className="relative flex gap-4">
                <span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${dotColor(m.status)}`} />
                <div>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">{m.label}</span>
                    <span className="text-sm text-slate-500">
                      {m.date ? fmt(m.date) : m.dateRange ? `${fmt(m.dateRange.start)} – ${fmt(m.dateRange.end)}` : ''}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{m.explanation}</p>
                  {m.sourceUrl && (
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-ink">
                      Official source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-semibold">Deadlines</h2>
          <div className="mt-4 space-y-3">
            {dl.data?.length === 0 && <p className="text-sm text-slate-400">No deadlines yet.</p>}
            {dl.data?.map((d) => {
              const n = daysUntil(d.dueDate);
              return (
                <div key={d.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{d.title}</span>
                    <span className={`text-xs font-medium ${n < 0 ? 'text-slate-400' : n <= 7 ? 'text-red-600' : n <= 30 ? 'text-amber-600' : 'text-slate-500'}`}>
                      {n < 0 ? 'passed' : `in ${n}d`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{fmt(d.dueDate)}</div>
                  {d.notes && <p className="mt-1 text-xs text-slate-500">{d.notes}</p>}
                  {!d.dismissedAt && (
                    <div className="mt-2">
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => dismiss.mutate(d.id)}
                        disabled={dismiss.isPending}
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
