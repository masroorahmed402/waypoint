'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, apiBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button, Card, Disclaimer } from '@/components/ui';
import { markDsoEmailDrafted } from '@/lib/engagement';
import { formatDeadline, formatDate } from '@/lib/format-date';
import { showToast } from '@/lib/toast';

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
interface OptUnemploymentSummary {
  periods: { id: string; startDate: string; endDate: string | null }[];
  daysUsed: number; daysRemaining: number; limit: number; warning: string | null;
}
interface UscisCase {
  id: string; receiptNumber: string; caseType: string;
  lastStatus: string | null; lastCheckedAt: string | null;
}

const CASE_TYPES = ['OPT', 'EAD', 'I-765', 'Other'];

function statusColor(status: string | null) {
  if (!status) return 'bg-slate-100 text-slate-500';
  const s = status.toLowerCase();
  if (s.includes('approved') || s.includes('card') || s.includes('produced')) return 'bg-emerald-100 text-emerald-700';
  if (s.includes('denied') || s.includes('rfe') || s.includes('request for evidence')) return 'bg-red-100 text-red-700';
  return 'bg-amber-100 text-amber-700';
}

const EMAIL_PURPOSES = [
  { value: 'opt_request', label: 'Requesting OPT authorization' },
  { value: 'cpt_request', label: 'Requesting CPT authorization' },
  { value: 'extension_request', label: 'Requesting a program extension' },
  { value: 'general_question', label: 'General immigration question' },
];

const URGENCY_GROUPS = [
  { key: 'urgent', label: '🔴 Urgent', test: (n: number) => n >= 0 && n <= 7 },
  { key: 'upcoming', label: '🟡 Upcoming', test: (n: number) => n > 7 && n <= 30 },
  { key: 'ontrack', label: '🟢 On track', test: (n: number) => n > 30 && n <= 90 },
  { key: 'future', label: '⚪ Future', test: (n: number) => n > 90 },
];

const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function ImmigrationPage() {
  return <AppShell><Inner /></AppShell>;
}

function DeadlineGroup({ label, deadlines, dismiss }: { label: string; deadlines: Deadline[]; dismiss: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  if (deadlines.length === 0) return null;
  return (
    <div className="rounded-xl border border-slate-200">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-ink"
      >
        <span>{label} ({deadlines.length})</span>
        <span className="text-slate-400">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          {deadlines.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-ink">{d.title}</p>
                <p className="text-xs text-slate-500">{formatDeadline(d.dueDate)} · {formatDate(d.dueDate)}</p>
              </div>
              {!d.dismissedAt && (
                <Button variant="ghost" className="px-2 py-1 text-xs" onClick={() => dismiss(d.id)}>Dismiss</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Inner() {
  const qc = useQueryClient();
  const router = useRouter();
  const { me } = useAuth();
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
  const cases = useQuery({ queryKey: ['uscis-cases'], queryFn: () => api<UscisCase[]>('/immigration/cases') });
  const optUnemployment = useQuery({
    queryKey: ['opt-unemployment-summary'],
    queryFn: () => api<OptUnemploymentSummary>('/immigration/opt-unemployment/summary'),
  });

  const startUnemployment = useMutation({
    mutationFn: () => api('/immigration/opt-unemployment/start', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opt-unemployment-summary'] }),
  });
  const endUnemployment = useMutation({
    mutationFn: () => api('/immigration/opt-unemployment/end', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['opt-unemployment-summary'] }),
  });

  const receiptInputRef = useRef<HTMLInputElement>(null);
  const [newReceipt, setNewReceipt] = useState('');
  const [newCaseType, setNewCaseType] = useState(CASE_TYPES[0]);
  const [caseError, setCaseError] = useState('');
  const [checkingKey, setCheckingKey] = useState<string | null>(null);

  const addCase = useMutation({
    mutationFn: () => api('/immigration/cases', { method: 'POST', body: JSON.stringify({ receiptNumber: newReceipt, caseType: newCaseType }) }),
    onSuccess: () => {
      setNewReceipt(''); setCaseError('');
      qc.invalidateQueries({ queryKey: ['uscis-cases'] });
    },
    onError: (e: any) => setCaseError(e.message ?? 'Could not add that case.'),
  });

  const removeCase = useMutation({
    mutationFn: (receiptNumber: string) => api(`/immigration/cases/${receiptNumber}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['uscis-cases'] }),
  });

  async function checkNow(receiptNumber: string) {
    setCheckingKey(receiptNumber);
    try {
      await api(`/immigration/cases/${receiptNumber}/check`);
      qc.invalidateQueries({ queryKey: ['uscis-cases'] });
    } finally {
      setCheckingKey(null);
    }
  }

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
      if (me?.id) markDsoEmailDrafted(me.id);
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
      showToast('Got it, we won’t remind you about this one');
    },
  });

  function askAboutMilestone(label: string) {
    router.push(`/advisor?q=${encodeURIComponent(`Tell me more about ${label} and what I need to do`)}`);
  }

  if (tl.isError) {
    return <p className="text-sm text-slate-500">Complete onboarding on the dashboard first.</p>;
  }

  const now = new Date();
  const activeCptOpt = cpt.data?.records.find(
    (r) => new Date(r.startDate) <= now && new Date(r.endDate) >= now,
  );

  const university = me?.profile?.university as any;
  const issUrl: string | undefined = university?.issOfficeUrl;
  const issEmail: string | undefined = university?.issEmail;

  const dotStyle = (s: Milestone['status']) =>
    s === 'PAST'
      ? 'bg-slate-300 border-slate-300'
      : s === 'CURRENT'
      ? 'bg-beacon border-beacon animate-pulse-beacon ring-4 ring-beacon/20'
      : 'bg-white border-slate-300';

  const labelStyle = (s: Milestone['status']) =>
    s === 'PAST' ? 'text-slate-400' : s === 'CURRENT' ? 'text-ink' : 'text-slate-700';

  const badgeStyle = (s: Milestone['status']) =>
    s === 'PAST'
      ? 'bg-slate-100 text-slate-400'
      : s === 'CURRENT'
      ? 'bg-beacon/20 text-beacon-600'
      : 'bg-slate-50 text-slate-500';

  // USCIS case tracking only applies once OPT is in the picture — CPT is school-authorized
  // and never gets a USCIS receipt number. Prompt either when an OPT record already exists,
  // or the student is nearing/just past their program end date, when the OPT filing window
  // (90 days before through 60 days after) is the reason they'd be filing at all.
  const hasOptRecord = (cpt.data?.records ?? []).some((r) => r.type === 'OPT');
  const daysToProgramEnd = me?.profile?.programEndDate
    ? Math.ceil((new Date(me.profile.programEndDate).getTime() - now.getTime()) / 86_400_000)
    : null;
  const nearOptWindow = daysToProgramEnd !== null && Math.abs(daysToProgramEnd) <= 90;
  const showUscisPrompt = (hasOptRecord || nearOptWindow) && (cases.data ?? []).length === 0;

  const grouped = URGENCY_GROUPS.map((g) => ({
    ...g,
    items: (dl.data ?? []).filter((d) => g.test(daysUntil(d.dueDate))),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-ink">Immigration</h1>
        <div className="flex items-center gap-3">
          {tl.data && <span className="text-xs text-slate-400">rules {tl.data.ruleVersion}</span>}
          <Button variant="ghost" onClick={exportCalendar} disabled={exporting}>
            {exporting ? 'Exporting…' : 'Export to calendar'}
          </Button>
        </div>
      </div>
      <Disclaimer />

      {showUscisPrompt && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-800">
            {hasOptRecord
              ? 'You have an OPT authorization on record. Add your I-765 receipt number to get notified the moment your EAD card status changes — no more manually checking the USCIS website.'
              : 'Your program end date is coming up, which is usually when students file for OPT. Once you have an I-765 receipt number, add it here to get notified the moment your EAD card status changes.'}
          </p>
          <button
            onClick={() => {
              receiptInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              receiptInputRef.current?.focus();
            }}
            className="mt-2 text-sm font-medium text-amber-900 hover:underline"
          >
            Add receipt number →
          </button>
        </div>
      )}

      {/* AI + DSO / USCIS top row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="font-display font-semibold text-ink">Your DSO</h2>
          {dso.data ? (
            <>
              <p className="mt-2 text-sm text-slate-600">
                <span className="font-semibold text-ink">{dso.data.name}</span>
                {dso.data.title ? `, ${dso.data.title}` : ''}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {issUrl && (
                  <a href={issUrl} target="_blank" rel="noopener noreferrer">
                    <Button variant="ghost" className="text-xs">Visit ISS Office ↗</Button>
                  </a>
                )}
                {issEmail && (
                  <a href={`mailto:${issEmail}`}>
                    <Button variant="ghost" className="text-xs">Contact your DSO</Button>
                  </a>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Upload your I-20 to auto-fill your DSO contact.</p>
          )}
          <Button
            variant="ghost"
            className="mt-4 text-xs"
            onClick={() => router.push('/advisor?q=' + encodeURIComponent('What should I ask my DSO about my current timeline?'))}
          >
            Ask AI about my timeline
          </Button>
        </Card>

        <Card>
          <h2 className="font-display font-semibold text-ink">Track your USCIS case</h2>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input
              ref={receiptInputRef}
              value={newReceipt}
              onChange={(e) => setNewReceipt(e.target.value)}
              placeholder="Receipt number (e.g. EAC2490123456)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <select
              value={newCaseType}
              onChange={(e) => setNewCaseType(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {CASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button onClick={() => addCase.mutate()} disabled={addCase.isPending || !newReceipt.trim()}>
              Add
            </Button>
          </div>
          {caseError && <p className="mt-2 text-sm text-red-600">{caseError}</p>}

          <div className="mt-4 space-y-2">
            {(cases.data ?? []).length === 0 ? (
              <p className="text-sm text-slate-400">No cases tracked yet.</p>
            ) : (
              cases.data!.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-sm font-semibold text-ink">{c.receiptNumber}</span>
                      <span className="ml-2 text-xs text-slate-500">{c.caseType}</span>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor(c.lastStatus)}`}>
                      {c.lastStatus ?? 'Not checked yet'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {c.lastCheckedAt ? `Last checked ${formatDate(c.lastCheckedAt)}` : 'Never checked'}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs"
                        onClick={() => checkNow(c.receiptNumber)}
                        disabled={checkingKey === c.receiptNumber}
                      >
                        {checkingKey === c.receiptNumber ? 'Checking…' : 'Check now'}
                      </Button>
                      <Button
                        variant="ghost"
                        className="px-2 py-1 text-xs text-red-600"
                        onClick={() => removeCase.mutate(c.receiptNumber)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">We check automatically every 6 hours and email you when status changes.</p>
        </Card>
      </div>

      {/* visual timeline */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="font-display font-semibold text-ink">Your F-1 journey</h2>
          <Button variant="ghost" className="text-xs" onClick={() => setDraftOpen(true)}>Draft DSO Email</Button>
        </div>
        <div className="relative mt-6">
          <div className="absolute bottom-1 left-4 top-1 w-0.5 bg-slate-200" />
          <div className="space-y-7">
            {tl.data?.milestones.map((m) => (
              <div key={m.key} className="relative flex gap-4 pl-11">
                <span
                  className={`absolute left-0 top-0.5 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${dotStyle(m.status)}`}
                >
                  {m.status === 'PAST' && <span className="text-xs text-slate-500">✓</span>}
                </span>
                <div className="flex-1 pb-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className={`font-display text-base font-semibold ${labelStyle(m.status)}`}>{m.label}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle(m.status)}`}>
                      {m.status === 'PAST'
                        ? 'passed'
                        : m.status === 'CURRENT'
                        ? 'now'
                        : formatDeadline(m.date ?? m.dateRange?.start ?? new Date().toISOString())}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {m.date ? formatDate(m.date) : m.dateRange ? `${formatDate(m.dateRange.start)} to ${formatDate(m.dateRange.end)}` : ''}
                  </p>
                  <p className={`mt-2 text-sm leading-relaxed ${m.status === 'PAST' ? 'text-slate-400' : 'text-slate-600'}`}>
                    {m.explanation}
                  </p>
                  {m.sourceUrl && (
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs text-ink hover:underline"
                    >
                      Official source →
                    </a>
                  )}
                  <button
                    onClick={() => askAboutMilestone(m.label)}
                    className="mt-2 block rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:border-ink hover:text-ink"
                  >
                    Ask AI about this
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {cpt.data && cpt.data.records.length > 0 && (
        <Card>
          <h2 className="font-display font-semibold text-ink">CPT/OPT summary</h2>
          <div className="mt-4 space-y-3">
            {cpt.data.records
              .filter((r) => new Date(r.startDate) <= new Date() && new Date(r.endDate) >= new Date())
              .map((r) => (
                <div key={r.id} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <div className="text-sm font-semibold text-ink">
                    Active {r.type}{r.employerName ? ` at ${r.employerName}` : ''}
                  </div>
                  <div className="mt-0.5 text-xs text-emerald-800">
                    Expires {formatDate(r.endDate)} ({formatDeadline(r.endDate)})
                  </div>
                </div>
              ))}
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
            <Link href="/resources/day1-cpt" className="inline-block text-xs font-medium text-ink underline">
              Considering Day 1 CPT? See the reference list of schools &rarr;
            </Link>
          </div>
        </Card>
      )}

      {me?.profile?.onReducedCourseLoad && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="font-display font-semibold text-ink">Reduced Course Load</h2>
          <p className="mt-2 text-sm text-amber-800">
            Your I-20 shows an authorized reduced course load{me.profile.rclEndDate ? ` through ${formatDate(me.profile.rclEndDate)}` : ''}.
            You must return to full-time enrollment or get a new authorization from your DSO before it ends.
          </p>
        </Card>
      )}

      {(me?.profile?.changeOfStatusDetected || me?.profile?.capGapDetected) && (
        <Card className="border-amber-200 bg-amber-50">
          <h2 className="font-display font-semibold text-ink">Change of Status / Cap-Gap detected</h2>
          <p className="mt-2 text-sm text-amber-800">
            We detected a Change of Status or Cap-Gap entry on your I-20. This is complex, please work closely
            with your DSO and consider consulting an immigration attorney.
          </p>
        </Card>
      )}

      {!!activeCptOpt && activeCptOpt.type === 'OPT' && optUnemployment.data && (
        <Card>
          <h2 className="font-display font-semibold text-ink">OPT unemployment tracker</h2>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Unemployment days used</span>
              <span className="font-semibold text-ink">{optUnemployment.data.daysUsed} / {optUnemployment.data.limit} days</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className={`h-full rounded-full ${
                  optUnemployment.data.daysUsed >= optUnemployment.data.limit - 15
                    ? 'bg-red-500'
                    : optUnemployment.data.daysUsed >= optUnemployment.data.limit - 30
                      ? 'bg-amber-500'
                      : 'bg-beacon'
                }`}
                style={{ width: `${Math.min(100, (optUnemployment.data.daysUsed / optUnemployment.data.limit) * 100)}%` }}
              />
            </div>
            {optUnemployment.data.warning && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-red-200">
                {optUnemployment.data.warning}
              </p>
            )}
            <div className="flex gap-2">
              {optUnemployment.data.periods.some((p) => !p.endDate) ? (
                <Button variant="ghost" className="text-xs" onClick={() => endUnemployment.mutate()}>Mark employed again</Button>
              ) : (
                <Button variant="ghost" className="text-xs" onClick={() => startUnemployment.mutate()}>Log an unemployment period</Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* deadlines grouped by urgency */}
      <div>
        <h2 className="font-display font-semibold text-ink">Deadlines</h2>
        <div className="mt-3 space-y-3">
          {(dl.data ?? []).length === 0 && <p className="text-sm text-slate-400">No deadlines yet.</p>}
          {grouped.map((g) => (
            <DeadlineGroup key={g.key} label={g.label} deadlines={g.items} dismiss={(id) => dismiss.mutate(id)} />
          ))}
        </div>
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
