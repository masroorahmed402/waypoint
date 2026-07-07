'use client';
import { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Card } from '@/components/ui';

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
const badgeClass = (type: string) => TYPE_BADGE[type] ?? 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';

const ALLOWED_EXT_ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const QUOTA_BYTES = 500 * 1024 * 1024;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
const fmtSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

export default function DocumentsPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadType, setUploadType] = useState<string>('I20');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [i20Banner, setI20Banner] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['documents'],
    queryFn: () => api<Doc[]>('/documents'),
  });

  const docs = data ?? [];
  const activeDocs = docs.filter((d) => d.status !== 'DELETED');
  const usedBytes = activeDocs.reduce((sum, d) => sum + d.sizeBytes, 0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError('File is too large — max 20MB.');
      if (fileRef.current) fileRef.current.value = '';
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

      await api(`/documents/${init.document.id}/confirm`, { method: 'POST' });
      qc.invalidateQueries({ queryKey: ['documents'] });
      if (uploadType === 'I20') setI20Banner(true);
    } catch (err: any) {
      setError(err.message ?? 'Upload failed — please try again.');
    } finally {
      setUploading(false);
      setProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Documents</h1>
          <p className="mt-1 text-sm text-slate-500">
            {fmtSize(usedBytes)} of {fmtSize(QUOTA_BYTES)} used
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={uploadType}
            onChange={(e) => setUploadType(e.target.value)}
            disabled={uploading}
          >
            {DOC_TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
          </select>
          <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? `Uploading… ${progress}%` : 'Upload'}
          </Button>
          <input ref={fileRef} type="file" accept={ALLOWED_EXT_ACCEPT} hidden onChange={onFile} />
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {i20Banner && (
        <div className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800 ring-1 ring-emerald-200">
          Want to update your timeline with dates from this I-20? Go to Settings.
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : activeDocs.length === 0 ? (
        <Card className="flex flex-col items-center py-12 text-center">
          <p className="font-medium">No documents yet.</p>
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
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeClass(d.type)}`}>
                    {TYPE_LABEL[d.type] ?? d.type}
                  </span>
                </div>
                <p className="mt-2 truncate text-sm font-medium" title={d.fileName}>{d.fileName}</p>
                <p className="mt-1 text-xs text-slate-500">Uploaded {fmtDate(d.createdAt)}</p>
                {d.expiryDate && (
                  <p className={`mt-1 text-xs font-medium ${expiryClass}`}>Expires {fmtDate(d.expiryDate)}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Button variant="ghost" className="text-xs" onClick={() => download(d.id)}>Download</Button>
                  <Button variant="danger" className="text-xs" onClick={() => remove(d.id)}>Delete</Button>
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
