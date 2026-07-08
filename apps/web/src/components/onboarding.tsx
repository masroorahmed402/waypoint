'use client';
import { useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { uploadAndExtractI20, I20Extract } from '@/lib/i20';
import { track } from '@/lib/posthog';
import { Button, Input, Label, Card, Disclaimer } from './ui';

const STEPS = ['Upload I-20', 'Program details', 'Personal info', 'Done'];

function StepIndicator({ step }: { step: number }) {
  return (
    <div className="mb-6 flex items-center justify-center">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                i < step
                  ? 'bg-emerald-600 text-white'
                  : i === step
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-300 text-slate-400'
              }`}
            >
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`mt-1 hidden text-[10px] sm:block ${i === step ? 'font-medium text-slate-700' : 'text-slate-400'}`}>
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`mx-2 h-px w-8 sm:w-12 ${i < step ? 'bg-emerald-600' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { refreshMe, me } = useAuth() as any;
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    universityName: '', major: '', degreeLevel: 'MASTERS', visaType: 'F1',
    programStartDate: '', programEndDate: '', usEntryDate: '',
  });
  const [personal, setPersonal] = useState({
    firstName: me?.firstName ?? '', lastName: me?.lastName ?? '',
  });
  const [prefilled, setPrefilled] = useState<Set<string>>(new Set());
  const [i20Notice, setI20Notice] = useState('');
  const [staleWarning, setStaleWarning] = useState('');
  const [cptOptFound, setCptOptFound] = useState<string[]>([]);
  const [stemBanner, setStemBanner] = useState('');
  const [stemEligible, setStemEligible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [skippedUpload, setSkippedUpload] = useState(false);
  const [sevisId, setSevisId] = useState<string | null>(null);
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
    if (x.sevisId) setSevisId(x.sevisId);

    // The backend appends a "⚠️ ..." stale-I20 nudge onto the end of notice —
    // split it out so it can be shown prominently instead of blended in.
    const notice = x.notice ?? '';
    const warnIdx = notice.indexOf('⚠️');
    setI20Notice(warnIdx === -1 ? notice : notice.slice(0, warnIdx).trim());
    setStaleWarning(warnIdx === -1 ? '' : notice.slice(warnIdx));

    setCptOptFound(
      x.authorizations
        .filter((a) => a.endDate)
        .map((a) => `${a.type} authorization${a.employerName ? ` at ${a.employerName}` : ''} through ${a.endDate}`),
    );

    if (x.isStemDegree) {
      setStemEligible(true);
      setStemBanner(
        `🎓 We detected your degree (CIP: ${x.cipCode}) qualifies for STEM OPT extension — you may be eligible for 24 additional months of OPT after graduation.`,
      );
    } else {
      setStemBanner('');
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setError(''); setI20Notice(''); setStaleWarning(''); setCptOptFound([]); setStemBanner('');
    try {
      const extract = await uploadAndExtractI20(file);
      track('i20_uploaded', { hasTextLayer: extract.hasTextLayer, fieldsFound: extract.foundFields.length });
      applyExtract(extract);
      setSkippedUpload(false);
      setStep(1);
    } catch (err: any) {
      setError(err.message ?? 'Could not read that file.');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function skipUpload() {
    setSkippedUpload(true);
    setError('');
    setStep(1);
  }

  async function submit() {
    setBusy(true); setError('');
    try {
      if (personal.firstName || personal.lastName) {
        await api('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({
            firstName: personal.firstName || undefined,
            lastName: personal.lastName || undefined,
          }),
        });
      }
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
          stemEligible,
          sevisId: sevisId || undefined,
        }),
      });
      track('onboarding_complete');
      await refreshMe();
      setStep(3);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  const fromI20 = (k: string) =>
    prefilled.has(k) ? 'ring-2 ring-emerald-200 border-emerald-300' : '';

  const canContinueStep1 = !!f.major && !!f.programStartDate && !!f.programEndDate;

  return (
    <Card className="mx-auto max-w-lg">
      <h1 className="text-xl font-semibold">Let&apos;s set up your timeline</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your key dates power deadline reminders. You can change them anytime.
      </p>

      <StepIndicator step={step} />

      {step === 0 && (
        <div className="mt-2">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">
            <p className="text-sm font-medium">Upload your most recent I-20</p>
            <p className="mt-1 text-xs text-slate-500">
              We&apos;ll auto-fill your program details and detect any CPT/OPT authorizations already on it.
              Make sure it&apos;s your latest — DSOs issue new I-20s for CPT, OPT, and program extensions.
            </p>
            <Button className="mt-4" type="button" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? 'Reading…' : 'Upload I-20'}
            </Button>
            <input ref={fileRef} type="file" accept="application/pdf" hidden onChange={onFile} />
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          </div>
          <button
            type="button"
            onClick={skipUpload}
            className="mt-4 w-full text-center text-sm text-slate-500 underline-offset-2 hover:underline"
          >
            Skip for now
          </button>
        </div>
      )}

      {step === 1 && (
        <div className="mt-2">
          {skippedUpload && (
            <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600">
              You can upload it later in Documents to auto-fill your dates.
            </p>
          )}
          {i20Notice && (
            <p className={`mb-3 rounded-lg px-3 py-2 text-xs ${prefilled.size ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
              {i20Notice}
            </p>
          )}
          {cptOptFound.map((line) => (
            <p key={line} className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Found {line} — we&apos;ll track this automatically.
            </p>
          ))}
          {stemBanner && (
            <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              {stemBanner}
            </p>
          )}
          {staleWarning && (
            <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
              {staleWarning}
            </p>
          )}

          <div className="space-y-3">
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
            {prefilled.size > 0 && (
              <p className="text-xs text-emerald-700">Green fields came from your I-20 — double-check them, then continue.</p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" type="button" onClick={() => setStep(0)} className="flex-1">Back</Button>
            <Button type="button" onClick={() => setStep(2)} disabled={!canContinueStep1} className="flex-1">Continue</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-2">
          <div className="space-y-3">
            <div>
              <Label>First name</Label>
              <Input value={personal.firstName} onChange={(e: any) => setPersonal({ ...personal, firstName: e.target.value })} placeholder="e.g. Priya" />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={personal.lastName} onChange={(e: any) => setPersonal({ ...personal, lastName: e.target.value })} placeholder="e.g. Sharma" />
            </div>
            <div>
              <Label>Latest U.S. arrival date (optional)</Label>
              <Input type="date" value={f.usEntryDate} onChange={set('usEntryDate')} />
              <p className="mt-1 text-xs text-slate-500">
                The most recent date you entered the U.S. — important if you&apos;ve traveled internationally.
              </p>
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

          <div className="mt-5 flex gap-2">
            <Button variant="ghost" type="button" onClick={() => setStep(1)} className="flex-1">Back</Button>
            <Button type="button" onClick={submit} disabled={busy} className="flex-1">
              {busy ? 'Saving…' : 'Finish'}
            </Button>
          </div>
          <Disclaimer />
        </div>
      )}

      {step === 3 && (
        <div className="mt-2 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">
            🎉
          </div>
          <p className="mt-3 text-sm font-medium">You&apos;re all set, {personal.firstName || 'there'}!</p>
          <div className="mt-4 space-y-1.5 text-left text-sm text-slate-600">
            <p><span className="text-slate-400">University:</span> {f.universityName || '—'}</p>
            <p><span className="text-slate-400">Program:</span> {f.major || '—'}</p>
            <p><span className="text-slate-400">Timeline:</span> {f.programStartDate || '—'} → {f.programEndDate || '—'}</p>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Your dashboard and deadlines are ready. You can fine-tune any of this later in Settings.
          </p>
        </div>
      )}
    </Card>
  );
}
