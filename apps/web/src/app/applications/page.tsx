'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Input, Label, Card } from '@/components/ui';

interface App {
  id: string; companyName: string; roleTitle: string; stage: string;
  url?: string; location?: string; sponsorshipConfirmed: string; notes?: string;
}

const STAGES = ['SAVED', 'APPLIED', 'OA', 'INTERVIEW', 'OFFER', 'REJECTED'] as const;
const STAGE_LABEL: Record<string, string> = {
  SAVED: 'Saved', APPLIED: 'Applied', OA: 'Online assessment', INTERVIEW: 'Interview', OFFER: 'Offer', REJECTED: 'Rejected',
};

export default function ApplicationsPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

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
        <Button onClick={() => setAdding(true)}>Add application</Button>
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
          <div className="mt-4"><Button onClick={() => setAdding(true)}>Add application</Button></div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((s) => (
            <div key={s} className="rounded-xl bg-slate-100/60 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{STAGE_LABEL[s]}</span>
                <span className="text-xs text-slate-400">{byStage(s).length}</span>
              </div>
              <div className="space-y-2">
                {byStage(s).map((a) => (
                  <div key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-sm font-medium">{a.roleTitle}</div>
                    <div className="text-xs text-slate-500">{a.companyName}</div>
                    {a.sponsorshipConfirmed === 'YES' && (
                      <span className="mt-1 inline-block rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">sponsors</span>
                    )}
                    <div className="mt-2 flex gap-1">
                      {STAGES.filter((x) => x !== s).slice(0, 3).map((target) => (
                        <button key={target} onClick={() => move.mutate({ id: a.id, stage: target })}
                          className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-200">
                          → {STAGE_LABEL[target].split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AddForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ companyName: '', roleTitle: '', url: '', location: '', sponsorshipConfirmed: 'UNKNOWN' });
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    try {
      await api('/career/applications', {
        method: 'POST',
        body: JSON.stringify({
          companyName: f.companyName, roleTitle: f.roleTitle,
          url: f.url || undefined, location: f.location || undefined,
          sponsorshipConfirmed: f.sponsorshipConfirmed,
        }),
      });
      onSaved();
    } finally { setBusy(false); }
  }

  return (
    <Card>
      <div className="grid gap-3 md:grid-cols-2">
        <div><Label>Company</Label><Input value={f.companyName} onChange={set('companyName')} /></div>
        <div><Label>Role</Label><Input value={f.roleTitle} onChange={set('roleTitle')} /></div>
        <div><Label>Job URL (optional)</Label><Input value={f.url} onChange={set('url')} /></div>
        <div><Label>Location (optional)</Label><Input value={f.location} onChange={set('location')} /></div>
        <div>
          <Label>Sponsors international?</Label>
          <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={f.sponsorshipConfirmed} onChange={set('sponsorshipConfirmed')}>
            <option value="UNKNOWN">Unknown</option>
            <option value="YES">Yes</option>
            <option value="NO">No</option>
          </select>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={save} disabled={busy || !f.companyName || !f.roleTitle}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  );
}
