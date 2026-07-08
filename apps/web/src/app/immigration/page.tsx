'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiBlob } from '@/lib/api';
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
interface CptOptRecord {
  id: string; type: string; status: string; fullOrPartTime: string | null;
  startDate: string; endDate: string; employerName: string | null; employerCity: string | null;
}
interface CptSummary {
  records: CptOptRecord[];
  fullTimeMonthsUsed: number;
  optEligible: boolean;
  monthsRemainingBeforeOptLoss: number;
  warning: string | null;
}
interface DsoContact { name: string; title: string | null; schoolName: string | null }

const EMAIL_PURPOSES = [
  { value: 'opt_request', label: 'Requesting OPT authorization' },
  { value: 'cpt_request', label: 'Requesting CPT authorization' },
  { value: 'extension_request', label: 'Requesting a program extension' },
  { value: 'general_question', label: 'General immigration question' },
];

const fmt = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function ImmigrationPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftPurpose, setDraftPurpose] = useState(EMAIL_PURPOSES[0].value);
  const [draftContext, setDraftContext] = useState('');
  const [draftBusy, setDraftBusy] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftResult, setDraftResult] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const tl = useQuery({ queryKey: ['timeline'], queryFn: () => api<Timeline>('/immigration/timeline') });
  const dl = useQuery({ queryKey: ['deadlines', 'all'], queryFn: () => api<Deadline[]>('/immigration/deadlines') });
  const cpt = useQuery({ queryKey: ['cpt-summary'], queryFn: () => api<CptSummary>('/immigration/cpt-summary') });
  const dso = useQuery({ queryKey: ['dso-contact'], queryFn: () => api<DsoContact | null>('/immigration/dso-contact') });

  async function exportCalendar() {
    setExporting(true);
    try {
      const blob = await apiBlob('/immigration/deadlines/export.ics');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waypoint-deadlines.ics';
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  async function generateDraft() {
    setDraftBusy(true); setDraftError(''); setCopied(false);
    try {
      const res = await api<{ subject: string; body: string } | null>('/immigration/draft-email', {
        method: 'POST',
        body: JSON.stringify({ purpose: draftPurpose, context: draftContext || undefined }),
      });
      if (!res) { setDraftError('AI advisor is not configured yet.'); return; }
      setDraftResult(res);
    } catch (e: any) {
      setDraftError(e.message ?? 'Could not generate a draft.');
    } finally {
      setDraftBusy(false);
    }
  }

  function copyDraft() {
    if (!draftResult) return;
    navigator.clipboard.writeText(`Subject: ${draftResult.subject}\n\n${draftResult.body}`);
    setCopied(true);
  }

  function closeDraftModal() {
    setDraftOpen(false);
    setDraftResult(null);
    setDraftError('');
    setDraftContext('');
    setCopied(false);
  }

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

  const dotStyle = (s: Milestone['status']) =>
    s === 'PAST'
      ? 'bg-slate-300 border-slate-300'
      : s === 'CURRENT'
      ? 'bg-ink border-ink ring-[6px] ring-ink/10'
      : 'bg-white border-slate-300';

  const labelStyle = (s: Milestone['status']) =>
    s === 'PAST' ? 'text-slate-400' : s === 'CURRENT' ? 'text-ink' : 'text-slate-700';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Immigration</h1>
        <div className="flex items-center gap-3">
          {tl.data && <span className="text-xs text-slate-400">rules {tl.data.ruleVersion}</span>}
          <Button variant="ghost" onClick={exportCalendar} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export to calendar'}
          </Button>
          <Button variant="ghost" onClick={() => setDraftOpen(true)}>Draft DSO Email</Button>
        </div>
      </div>
      <Disclaimer />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <h2 className="font-display font-semibold text-ink">Your F-1 journey</h2>
          <ol className="mt-6 space-y-0">
            {tl.data?.milestones.map((m, i) => (
              <li key={m.key} className="relative flex gap-5 pb-8 last:pb-0">
                {i < (tl.data?.milestones.length ?? 0) - 1 && (
                  <span className="absolute left-[9px] top-5 h-full w-px bg-slate-200" />
                )}
                <span className={`relative mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${dotStyle(m.status)}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className={`font-semibold ${labelStyle(m.status)}`}>{m.label}</span>
                    {m.status === 'CURRENT' && (
                      <span className="rounded-full bg-ink/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">now</span>
                    )}
                    <span className="text-sm text-slate-500">
                      {m.date ? fmt(m.date) : m.dateRange ? `${fmt(m.dateRange.start)} – ${fmt(m.dateRange.end)}` : ''}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{m.explanation}</p>
                  {m.sourceUrl && (
                    <a href={m.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-xs font-medium text-ink hover:underline">
                      Official source ↗
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-ink">Deadlines</h2>
          <div className="mt-4 space-y-3">
            {dl.data?.length === 0 && <p className="text-sm text-slate-400">No deadlines yet.</p>}
            {dl.data?.map((d) => {
              const n = daysUntil(d.dueDate);
              const urgent = n >= 0 && n <= 7;
              const soon = n > 7 && n <= 30;
              return (
                <div
                  key={d.id}
                  className={`rounded-xl border p-3.5 shadow-sm transition ${
                    urgent ? 'border-red-200 bg-red-50/50' : soon ? 'border-amber-200 bg-amber-50/40' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-ink">{d.title}</span>
                    <span className={`shrink-0 text-xs font-semibold ${n < 0 ? 'text-slate-400' : urgent ? 'text-red-600' : soon ? 'text-amber-600' : 'text-slate-500'}`}>
                      {n < 0 ? 'passed' : n === 0 ? 'today' : `in ${n}d`}
                    </span>
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">{fmt(d.dueDate)}</div>
                  {d.notes && <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{d.notes}</p>}
                  {!d.dismissedAt && (
                    <div className="mt-2.5">
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

        {cpt.data && cpt.data.records.length > 0 && (
          <Card>
            <h2 className="font-display font-semibold text-ink">CPT/OPT summary</h2>
            <div className="mt-4 space-y-3">
              {cpt.data.records
                .filter((r) => new Date(r.startDate) <= new Date() && new Date(r.endDate) >= new Date())
                .map((r) => {
                  const n = daysUntil(r.endDate);
                  return (
                    <div key={r.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                      <div className="text-sm font-semibold text-ink">
                        Active {r.type}{r.employerName ? ` at ${r.employerName}` : ''}
                      </div>
                      <div className="mt-0.5 text-xs text-emerald-800">
                        Expires {fmt(r.endDate)} ({n < 0 ? 'passed' : `in ${n}d`})
                      </div>
                    </div>
                  );
                })}
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Full-time CPT used</span>
                <span className="font-semibold text-ink">{cpt.data.fullTimeMonthsUsed} / 12 months</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full ${cpt.data.fullTimeMonthsUsed >= 9 ? 'bg-red-500' : 'bg-beacon'}`}
                  style={{ width: `${Math.min(100, (cpt.data.fullTimeMonthsUsed / 12) * 100)}%` }}
                />
              </div>
              {cpt.data.warning && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">
                  {cpt.data.warning}
                </p>
              )}
            </div>
          </Card>
        )}

        {dso.data && (
          <Card>
            <h2 className="font-display font-semibold text-ink">Your DSO</h2>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-semibold text-ink">{dso.data.name}</span>
              {dso.data.title ? `, ${dso.data.title}` : ''} — contact them for immigration questions.
            </p>
          </Card>
        )}
      </div>

      {draftOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-ink">Draft DSO email</h2>
              <button onClick={closeDraftModal} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            {!draftResult ? (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Purpose</label>
                  <select
                    value={draftPurpose}
                    onChange={(e) => setDraftPurpose(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {EMAIL_PURPOSES.map((p) => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Additional context (optional)</label>
                  <textarea
                    value={draftContext}
                    onChange={(e) => setDraftContext(e.target.value)}
                    rows={3}
                    placeholder="Anything specific your DSO should know…"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
                  />
                </div>
                {draftError && <p className="text-sm text-red-600">{draftError}</p>}
                <Button onClick={generateDraft} disabled={draftBusy} className="w-full">
                  {draftBusy ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Subject</p>
                  <p className="mt-0.5 text-sm font-medium text-ink">{draftResult.subject}</p>
                  <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{draftResult.body}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={copyDraft}>{copied ? 'Copied!' : 'Copy to clipboard'}</Button>
                  <Button variant="ghost" onClick={() => setDraftResult(null)}>Start over</Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
