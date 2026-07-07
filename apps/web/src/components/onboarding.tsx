'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { uploadAndExtractI20, I20Extract } from '@/lib/i20';
import { track } from '@/lib/posthog';
import { Button, Input, Label, Card, Disclaimer } from './ui';

export default function Onboarding() {
  const { refreshMe } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({
    universityName: '', major: '', degreeLevel: 'MASTERS', visaType: 'F1',
    programStartDate: '', programEndDate: '', usEntryDate: '',
  });
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [i20Notice, setI20Notice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: any) => {
    setF({ ...f, [k]: e.target.value });
    if (prefilled.has(k)) { const n = new Set(prefilled); n.delete(k); setPrefilled(n); }
  };

  function applyExtract(x: I20Extract) {
    const next = { ...f };
    const filled = new Set<string>();
    if (x.schoolName) { next.universityName = x.schoolName; filled.add('universityName'); }
    if (x.programOfStudy) { next.major = x.programOfStudy; filled.add('major'); }
    if (x.degreeLevel) { next.degreeLevel = x.degreeLevel; filled.add('degreeLevel'); }
    if (x.programStartDate) { next.programStartDate = x.programStartDate; filled.add('programStartDate'); }
    if (x.programEndDate) { next.programEndDate = x.programEndDate; filled.add('programEndDate'); }
    setF(next);
    setPrefilled(filled);
    setI20Notice(x.notice ?? '');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setI20Notice('');
    try {
      const extract = await uploadAndExtractI20(file);
      track('i20_uploaded', { hasTextLayer: extract.hasTextLayer, fieldsFound: extract.foundFields.length });
      applyExtract(extract);
    } catch (err: any) {
      setError(err.message ?? 'Could not read that file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      await api('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          universityName: f.universityName || undefined,
          major: f.major,
          degreeLevel: f.degreeLevel,
          visaType: f.visaType,
          programStartDate: new Date(f.programStartDate).toISOString(),
          programEndDate: new Date(f.programEndDate).toISOString(),
          usEntryDate: f.usEntryDate ? new Date(f.usEntryDate).toISOString() : undefined,
        }),
      });
      track('onboarding_complete');
      await refreshMe();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const fromI20 = (k: string) =>
    prefilled.has(k) ? 'ring-2 ring-emerald-200 border-emerald-300' : '';

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">Let&apos;s set up your timeline</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your key dates power deadline reminders. You can change them anytime.
      </p>

      <div className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Have your I-20 handy?</p>
            <p className="text-xs text-slate-500">Upload the PDF and we&apos;ll fill in what we can — you review before saving.</p>
          </div>
          <Button variant="ghost" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? 'Reading…' : 'Upload I-20'}
          </Button>
          <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
        </div>
        {i20Notice && (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${prefilled.size ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
            {i20Notice}
          </p>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <div>
          <Label>University</Label>
          <Input className={fromI20('universityName')} value={f.universityName} onChange={set('universityName')} placeholder="e.g. DePaul University" />
        </div>
        <div>
          <Label>Major / program</Label>
          <Input aria-label="Major / program" className={fromI20('major')} value={f.major} onChange={set('major')} placeholder="e.g. Computer Science" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Degree level</Label>
            <select className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm ${fromI20('degreeLevel')}`} value={f.degreeLevel} onChange={set('degreeLevel')}>
              <option value="BACHELORS">Bachelor&apos;s</option>
              <option value="MASTERS">Master&apos;s</option>
              <option value="PHD">PhD</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <Label>Visa type</Label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={f.visaType} onChange={set('visaType')}>
              <option value="F1">F-1</option>
              <option value="J1">J-1</option>
              <option value="M1">M-1</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Program start</Label>
            <Input aria-label="Program start" type="date" className={fromI20('programStartDate')} value={f.programStartDate} onChange={set('programStartDate')} />
          </div>
          <div>
            <Label>Program end</Label>
            <Input aria-label="Program end" type="date" className={fromI20('programEndDate')} value={f.programEndDate} onChange={set('programEndDate')} />
          </div>
        </div>
        <div><Label>U.S. entry date (optional)</Label><Input type="date" value={f.usEntryDate} onChange={set('usEntryDate')} /></div>
        {prefilled.size > 0 && (
          <p className="text-xs text-emerald-700">Green fields came from your I-20 — double-check them, then continue.</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={submit} disabled={busy || !f.major || !f.programStartDate || !f.programEndDate} className="w-full">
          {busy ? 'Saving…' : 'Build my timeline'}
        </Button>
        <Disclaimer />
      </div>
    </Card>
  );
}
