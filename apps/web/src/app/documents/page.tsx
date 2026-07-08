'use client';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Card, Skeleton } from '@/components/ui';
import { SecurityBadge } from '@/components/security-badge';
import { formatDeadline, formatDate } from '@/lib/format-date';
import { showToast } from '@/lib/toast';

interface Doc {
  id: string; type: string; status: string; fileName: string; contentType: string;
  sizeBytes: number; issueDate: string | null; expiryDate: string | null; createdAt: string;
}

const DOC_TYPES = [
  'PASSPORT', 'VISA_STAMP', 'I20', 'I94', 'EAD', 'DRIVERS_LICENSE', 'STATE_ID',
  'INSURANCE', 'LEASE', 'TAX', 'OFFER_LETTER', 'TRANSCRIPT', 'OTHER',
] as const;

const TYPE_LABEL: Record<string, string> = {
  PASSPORT: 'Passport', VISA_STAMP: 'Visa stamp', I20: 'I-20', I94: 'I-94', EAD: 'EAD',
  DRIVERS_LICENSE: "Driver's license", STATE_ID: 'State ID', INSURANCE: 'Insurance',
  LEASE: 'Lease', TAX: 'Tax', OFFER_LETTER: 'Offer letter', TRANSCRIPT: 'Transcript', OTHER: 'Other',
};

const TYPE_BADGE: Record<string, string> = {
  PASSPORT: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  I20: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  EAD: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  VISA_STAMP: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
};
const TYPE_ICON: Record<string, string> = {
  PASSPORT: '🛂', VISA_STAMP: '🛃', I20: '📄', I94: '📋', EAD: '🪪',
  DRIVERS_LICENSE: '🪪', STATE_ID: '🪪', INSURANCE: '🏥', LEASE: '🏠',
  TAX: '🧾', OFFER_LETTER: '💼', TRANSCRIPT: '🎓', OTHER: '📁',
};
const badgeClass = (type: string) => TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

const ALLOWED_EXT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const QUOTA_BYTES = 500 * 1024 * 1024;
const PRIMARY_I20_KEY = 'waypoint_primary_i20';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

function StorageDonut({ usedBytes }: { usedBytes: number }) {
  const pct = Math.min(100, Math.round((usedBytes / QUOTA_BYTES) * 100));
  const r = 30;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - pct / 100);
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[72px] w-[72px] shrink-0">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <circle
            cx="36" cy="36" r={r} fill="none" stroke={pct > 85 ? '#dc2626' : '#e6a53a'} strokeWidth="7" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-sm font-semibold text-ink">{pct}%</div>
      </div>
      <div>
        <p className="text-sm font-medium text-ink">{fmtSize(usedBytes)} of {fmtSize(QUOTA_BYTES)} used</p>
        <p className="text-xs text-slate-500">Secure document storage</p>
      </div>
    </div>
  );
}

export default function DocumentsPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>('I20');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [analyzing, setAnalyzing] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [error, setError] = useState('');
  const [i20Banner, setI20Banner] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [primaryI20, setPrimaryI20] = useState<string | null>(null);

  useEffect(() => {
    setPrimaryI20(window.localStorage.getItem(PRIMARY_I20_KEY));
  }, []);

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<Doc[]>('/documents'),
  });

  const docs = data ?? [];
  const activeDocs = docs.filter((d) => d.status !== 'DELETED');
  const usedBytes = activeDocs.reduce((sum, d) => sum + d.sizeBytes, 0);

  async function uploadFile(file: File) {
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — max 20MB.');
      return;
    }

    setUploading(true);
    setProgress(0);
    try {
      const init = await api<{ document: { id: string }; upload: { url: string; headers?: Record<string, string> } }>(
        '/documents',
        {
          method: 'POST',
          body: JSON.stringify({
            type: uploadType,
            fileName: file.name,
            contentType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        },
      );

      await putWithProgress(init.upload.url, file, init.upload.headers, setProgress);

      setUploading(false);
      setJustUploaded(true);
      if (uploadType === 'I20') setAnalyzing(true);
      await api(`/documents/${init.document.id}/confirm`, { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (uploadType === 'I20') setI20Banner(true);
      showToast('Document saved securely');
      setTimeout(() => { setJustUploaded(false); setAnalyzing(false); }, 1600);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed — please try again.');
      setUploading(false);
    } finally {
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this document? This cannot be undone.')) return;
    await api(`/documents/${id}`, { method: 'DELETE' });
    qc.invalidateQueries({ queryKey: ['documents'] });
  }

  async function download(id: string) {
    const { url } = await api<{ url: string }>(`/documents/${id}/download`);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  function setPrimary(id: string) {
    window.localStorage.setItem(PRIMARY_I20_KEY, id);
    setPrimaryI20(id);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold">Documents</h1>
        <StorageDonut usedBytes={usedBytes} />
      </div>

      {/* upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`rounded-2xl border-2 border-dashed p-8 text-center transition-colors ${
          dragOver ? 'border-beacon bg-beacon/10' : 'border-slate-300 bg-white'
        }`}
      >
        {uploading ? (
          <div className="mx-auto max-w-xs">
            <p className="text-sm font-medium text-ink">Uploading… {progress}%</p>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-beacon transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        ) : justUploaded ? (
          <div className="animate-fade-in">
            <span className="text-3xl">✅</span>
            <p className="mt-2 text-sm font-medium text-ink">
              {analyzing ? 'Analyzing document…' : 'Document saved securely'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center gap-3 text-3xl">📄 🛂 🪪</div>
            <p className="mt-3 text-sm font-medium text-ink">Drag &amp; drop your I-20, passport, or visa</p>
            <p className="mt-1 text-xs text-slate-500">or click to browse — PDF, JPG, PNG up to 20MB</p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <select
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                value={uploadType}
                onChange={(e) => setUploadType(e.target.value)}
              >
                {DOC_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
              </select>
              <Button onClick={() => fileRef.current?.click()}>Choose file</Button>
              <input ref={fileRef} type="file" accept={ALLOWED_EXT_ACCEPT} hidden onChange={onFile} />
            </div>
          </>
        )}
      </div>

      <SecurityBadge variant="banner" />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {i20Banner && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Want to update your timeline with dates from this I-20? Go to Settings.
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
        </div>
      ) : activeDocs.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" className="text-slate-300">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
            <path d="M14 2v6h6" strokeLinejoin="round" />
          </svg>
          <p className="mt-3 font-medium">No documents yet.</p>
          <p className="mt-1 text-sm text-slate-500">Upload your I-20, passport, or visa to get started.</p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activeDocs.map((d) => {
            const expiryDays = d.expiryDate ? daysUntil(d.expiryDate) : null;
            const expiryClass =
              expiryDays === null ? '' : expiryDays <= 60 ? 'text-red-600' : expiryDays <= 180 ? 'text-amber-600' : 'text-emerald-600';
            return (
              <Card key={d.id}>
                <div className="flex items-start justify-between gap-2">
                  <span className="text-2xl">{TYPE_ICON[d.type] ?? '📁'}</span>
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(d.type)}`}>
                    {TYPE_LABEL[d.type] ?? d.type}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-medium" title={d.fileName}>{d.fileName}</p>
                <p className="mt-1 text-xs text-slate-500">Uploaded {fmtDate(d.createdAt)}</p>
                {d.expiryDate && (
                  <p className={`mt-1 text-xs font-medium ${expiryClass}`}>
                    Expires {formatDeadline(d.expiryDate)} ({formatDate(d.expiryDate)})
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="ghost" className="text-xs" onClick={() => download(d.id)}>Download</Button>
                  <Button variant="danger" className="text-xs" onClick={() => remove(d.id)}>Delete</Button>
                  {d.type === 'I20' && primaryI20 !== d.id && (
                    <Button variant="ghost" className="text-xs" onClick={() => setPrimary(d.id)}>Set as primary</Button>
                  )}
                  {d.type === 'I20' && primaryI20 === d.id && (
                    <span className="rounded bg-beacon/20 px-2 py-1 text-xs font-medium text-beacon-600">Primary</span>
                  )}
                </div>
                <div className="mt-3">
                  <SecurityBadge />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function putWithProgress(
  url: string,
  file: File,
  headers: Record<string, string> | undefined,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    const h = headers ?? { 'Content-Type': file.type || 'application/octet-stream' };
    Object.entries(h).forEach(([k, v]) => xhr.setRequestHeader(k, v));
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error('Upload failed — please try again.'));
    };
    xhr.onerror = () => reject(new Error('Upload failed — please try again.'));
    xhr.send(file);
  });
}
