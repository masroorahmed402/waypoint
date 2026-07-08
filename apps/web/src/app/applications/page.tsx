'use client';
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Input, Label, Card } from '@/components/ui';

interface App {
  id: string; companyName: string; roleTitle: string; stage: string;
  url?: string; location?: string; sponsorshipConfirmed: string; notes?: string;
  appliedAt?: string; salaryMin?: number; salaryMax?: number;
  company?: { id: string; name: string; sponsorsH1b: boolean | null } | null;
}

interface CompanyResult { id: string; name: string; domain: string | null; sponsorsH1b: boolean | null }
interface H1bData { totalPetitions: number; sponsorsInternational: boolean | null; error?: string }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const fmtSalary = (min?: number, max?: number) => {
  if (!min && !max) return null;
  const f = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : n);
  if (min && max) return `$${f(min)}–${f(max)}`;
  return `$${f((min ?? max)!)}`;
};

const STAGES = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
const STAGE_LABEL: Record<string, string> = {
  SAVED: 'Saved', APPLIED: 'Applied', OA: 'Online assessment', INTERVIEW: 'Interview', OFFER: 'Offer', REJECTED: 'Rejected',
};

const STAGE_COLOR: Record<string, { border: string; pill: string }> = {
  SAVED: { border: 'border-l-slate-400', pill: 'bg-slate-100 text-slate-600' },
  APPLIED: { border: 'border-l-blue-500', pill: 'bg-blue-100 text-blue-700' },
  OA: { border: 'border-l-yellow-500', pill: 'bg-yellow-100 text-yellow-700' },
  INTERVIEW: { border: 'border-l-purple-500', pill: 'bg-purple-100 text-purple-700' },
  OFFER: { border: 'border-l-green-500', pill: 'bg-green-100 text-green-700' },
  REJECTED: { border: 'border-l-red-500', pill: 'bg-red-100 text-red-700' },
};

export default function ApplicationsPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [mobileStage, setMobileStage] = useState<string>(STAGES[0]);

  const { data, isLoading } = useQuery({
    queryKey: ['applications'],
    queryFn: () => api<{ data: App[] }>('/career/applications'),
  });

  const move = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) =>
      api(`/career/applications/${id}`, { method: 'PATCH', body: JSON.stringify({ stage }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['applications'] }),
  });

  const apps = data?.data ?? [];
  const byStage = (s: string) => apps.filter((a) => a.stage === s);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Applications</h1>
        <Button variant="accent" onClick={() => setAdding(true)}>Add application</Button>
      </div>

      {adding && <AddForm onClose={() => setAdding(false)} onSaved={() => { setAdding(false); qc.invalidateQueries({ queryKey: ['applications'] }); }} />}

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : apps.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-300">
            <path d="M3 7a2 2 0 0 1 2-2h3l1-2h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" strokeLinejoin="round" />
            <path d="M3 11h18" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 font-medium">No applications yet</p>
          <p className="mt-1 text-sm text-slate-500">Add your first application and track it from saved to offer.</p>
          <div className="mt-4"><Button variant="accent" onClick={() => setAdding(true)}>Add application</Button></div>
        </Card>
      ) : (
        <>
          {/* Mobile: stage picker + single column */}
          <div className="md:hidden">
            <select
              value={mobileStage}
              onChange={(e) => setMobileStage(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium shadow-sm"
            >
              {STAGES.map((s) => (
                <option key={s} value={s}>{STAGE_LABEL[s]} ({byStage(s).length})</option>
              ))}
            </select>
            <div className="mt-4">
              <StageColumn stage={mobileStage} items={byStage(mobileStage)} onMove={(id, stage) => move.mutate({ id, stage })} />
            </div>
          </div>

          {/* Desktop: horizontal-scroll kanban */}
          <div className="hidden gap-4 overflow-x-auto pb-2 md:flex">
            {STAGES.map((s) => (
              <div key={s} className="w-[200px] shrink-0 rounded-xl bg-slate-50 p-3">
                <StageHeader stage={s} count={byStage(s).length} />
                <StageColumn stage={s} items={byStage(s)} onMove={(id, stage) => move.mutate({ id, stage })} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StageHeader({ stage, count }: { stage: string; count: number }) {
  const color = STAGE_COLOR[stage];
  return (
    <div className={`mb-3 flex items-center justify-between border-l-4 px-2 py-1 ${color.border}`}>
      <span className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${color.pill}`}>
        {STAGE_LABEL[stage]}
      </span>
      <span className="text-xs text-slate-400">{count}</span>
    </div>
  );
}

function StageColumn({ stage, items, onMove }: { stage: string; items: App[]; onMove: (id: string, stage: string) => void }) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-xs text-slate-400">
        No applications
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const salary = fmtSalary(a.salaryMin, a.salaryMax);
        const h1b = a.company?.sponsorsH1b;
        return (
          <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md">
            <div className="text-base font-bold text-ink">{a.roleTitle}</div>
            <div className="text-xs text-slate-500">{a.companyName}</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {h1b === true ? (
                <span className="inline-block rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">
                  Sponsors
                </span>
              ) : h1b === false ? (
                <span className="inline-block rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white">
                  No sponsorship
                </span>
              ) : a.sponsorshipConfirmed === 'YES' ? (
                <span className="inline-block rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">
                  Sponsors
                </span>
              ) : null}
              {salary && (
                <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  {salary}
                </span>
              )}
              <H1bBadge companyName={a.companyName} compact />
            </div>
            {a.appliedAt && (
              <div className="mt-1.5 text-[11px] text-slate-400">Applied {fmtDate(a.appliedAt)}</div>
            )}
            {a.notes && (
              <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">{a.notes}</p>
            )}
            <div className="mt-2.5">
              <select
                value=""
                onChange={(e) => e.target.value && onMove(a.id, e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-600 shadow-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-ink/10"
              >
                <option value="">Move to…</option>
                {STAGES.filter((x) => x !== stage).map((target) => (
                  <option key={target} value={target}>{STAGE_LABEL[target]}</option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AddForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({
    companyName: '', roleTitle: '', url: '', location: '', sponsorshipConfirmed: 'UNKNOWN',
    salaryMin: '', salaryMax: '', notes: '',
  });
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [newCompanySponsorsH1b, setNewCompanySponsorsH1b] = useState<string>('UNKNOWN');
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const { data: h1bData } = useH1bData(f.companyName);
  // Only ask the user to manually mark H-1B sponsorship when auto-detection
  // found nothing conclusive — a positive petition count speaks for itself.
  const showManualH1b = !h1bData || h1bData.totalPetitions === 0 || !!h1bData.error;

  function onCompanyNameChange(name: string) {
    setF({ ...f, companyName: name });
    setSelectedCompanyId(null); // typing invalidates a prior selection
  }

  function onSelectCompany(c: CompanyResult) {
    setF({ ...f, companyName: c.name });
    setSelectedCompanyId(c.id);
  }

  async function save() {
    setBusy(true);
    try {
      let companyId = selectedCompanyId ?? undefined;
      if (!companyId && f.companyName.trim()) {
        const h1b = newCompanySponsorsH1b === 'UNKNOWN' ? undefined : newCompanySponsorsH1b === 'YES';
        const company = await api<{ id: string }>('/career/companies', {
          method: 'POST',
          body: JSON.stringify({ name: f.companyName.trim(), sponsorsH1b: h1b }),
        });
        companyId = company.id;
      }
      await api('/career/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: f.companyName, companyId, roleTitle: f.roleTitle,
          url: f.url || undefined, location: f.location || undefined,
          sponsorshipConfirmed: f.sponsorshipConfirmed,
          salaryMin: f.salaryMin ? Number(f.salaryMin) : undefined,
          salaryMax: f.salaryMax ? Number(f.salaryMax) : undefined,
          notes: f.notes || undefined,
        }),
      });
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label>Company</Label>
          <CompanyTypeahead value={f.companyName} onChange={onCompanyNameChange} onSelect={onSelectCompany} />
          {f.companyName.trim() && (
            <div className="mt-1.5"><H1bBadge companyName={f.companyName} /></div>
          )}
        </div>
        <div><Label>Role</Label><Input value={f.roleTitle} onChange={set('roleTitle')} /></div>
        <div><Label>Job URL (optional)</Label><Input value={f.url} onChange={set('url')} /></div>
        <div><Label>Location (optional)</Label><Input value={f.location} onChange={set('location')} /></div>
        <div><Label>Salary min (optional)</Label><Input type="number" value={f.salaryMin} onChange={set('salaryMin')} /></div>
        <div><Label>Salary max (optional)</Label><Input type="number" value={f.salaryMax} onChange={set('salaryMax')} /></div>
        <div>
          <Label>Sponsors F-1 students (CPT/OPT)?</Label>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={f.sponsorshipConfirmed} onChange={set('sponsorshipConfirmed')}>
            <option value="UNKNOWN">Unknown</option>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
          </select>
        </div>
        {!selectedCompanyId && f.companyName.trim() && showManualH1b && (
          <div>
            <Label>New company — sponsors H-1B?</Label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={newCompanySponsorsH1b} onChange={(e) => setNewCompanySponsorsH1b(e.target.value)}>
              <option value="UNKNOWN">Unknown</option>
              <option value="YES">Yes</option>
              <option value="NO">No</option>
            </select>
          </div>
        )}
        <div className="md:col-span-2"><Label>Notes (optional)</Label><Input value={f.notes} onChange={set('notes')} /></div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save} disabled={busy || !f.companyName || !f.roleTitle}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}

function CompanyTypeahead({ value, onChange, onSelect }: {
  value: string;
  onChange: (name: string) => void;
  onSelect: (c: CompanyResult) => void;
}) {
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!value.trim()) { setResults([]); return; }
    const t = setTimeout(() => {
      api<CompanyResult[]>(`/career/companies?query=${encodeURIComponent(value.trim())}`)
        .then((r) => setResults(r))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(t);
  }, [value]);

  return (
    <div className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="e.g. Acme Corp"
      />
      {open && results.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 bg-white shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => onSelect(c)}
              className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span>{c.name}</span>
              {c.sponsorsH1b === true && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-medium text-white">Sponsors</span>}
              {c.sponsorsH1b === false && <span className="rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-medium text-white">No sponsorship</span>}
              {c.sponsorsH1b == null && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">Unknown</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live H-1B disclosure lookup for a company name — cached per unique name by react-query. */
function useH1bData(companyName: string) {
  return useQuery({
    queryKey: ['h1b', companyName.toLowerCase().trim()],
    queryFn: () => api<H1bData>(`/career/companies/${encodeURIComponent(companyName)}/h1b`),
    enabled: !!companyName.trim(),
    staleTime: 60 * 60 * 1000,
  });
}

function H1bBadge({ companyName, compact }: { companyName: string; compact?: boolean }) {
  const { data, isLoading } = useH1bData(companyName);

  if (!companyName.trim()) return null;
  if (isLoading) {
    return <span className="inline-block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">? Checking…</span>;
  }
  if (!data || data.error || !data.totalPetitions) {
    return (
      <span className={`inline-block rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-700 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        ⚠ No H-1B history found
      </span>
    );
  }
  return (
    <span className={`inline-block rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700 ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
      ✓ {data.totalPetitions.toLocaleString()} H-1B petitions in {2024}
    </span>
  );
}
