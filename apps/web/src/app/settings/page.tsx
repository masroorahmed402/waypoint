'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button, Input, Label, Card } from '@/components/ui';

export default function SettingsPage() {
  return <AppShell><Inner /></AppShell>;
}

const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

function SevisIdCard() {
  const [revealed, setRevealed] = useState(false);
  const [password, setPassword] = useState('');
  const [sevisId, setSevisId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function reveal() {
    setBusy(true); setError('');
    try {
      // Re-authenticate to get SEVIS ID
      const res = await api<{ sevisId: string | null }>('/users/me/sevis-id', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      setSevisId(res.sevisId);
      setRevealed(true);
    } catch {
      setError('Incorrect password');
    } finally { setBusy(false); }
  }

  return (
    <Card className="p-6">
      <h2 className="font-display text-lg font-semibold text-ink">SEVIS ID</h2>
      <p className="mt-1 text-sm text-slate-500">
        Your SEVIS ID is stored encrypted. Enter your password to view it.
      </p>
      {!revealed ? (
        <div className="mt-3 flex gap-2">
          <Input type="password" placeholder="Your password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && reveal()} />
          <Button onClick={reveal} disabled={busy || !password}>
            {busy ? 'Verifying…' : 'View'}
          </Button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="rounded-lg bg-slate-50 px-4 py-3 font-mono text-lg tracking-widest text-ink">
            {sevisId ?? 'Not stored — upload your I-20 to save it'}
          </div>
          <button onClick={() => { setRevealed(false); setPassword(''); setSevisId(null); }}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600">
            Hide
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </Card>
  );
}

function Inner() {
  const { me, refreshMe, logout } = useAuth();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');

  const profile = me?.profile;
  const [pf, setPf] = useState({
    universityName: profile?.universityName ?? profile?.university?.name ?? '',
    major: profile?.major ?? '',
    degreeLevel: profile?.degreeLevel ?? 'MASTERS',
    visaType: profile?.visaType ?? 'F1',
    programStartDate: toDateInput(profile?.programStartDate),
    programEndDate: toDateInput(profile?.programEndDate),
    usEntryDate: toDateInput(profile?.usEntryDate),
    stemEligible: profile?.stemEligible ?? false,
  });
  const setP = (k: string) => (e: any) => setPf({ ...pf, [k]: e.target.value });
  const [profileSaved, setProfileSaved] = useState(false);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState('');

  async function save() {
    setBusy(true); setSaved(false);
    try {
      await api('/users/me', { method: 'PATCH', body: JSON.stringify({ firstName, lastName }) });
      await refreshMe();
      setSaved(true);
    } finally { setBusy(false); }
  }

  async function saveProfile() {
    setProfileBusy(true); setProfileSaved(false); setProfileError('');
    try {
      await api('/users/me/profile', {
        method: 'PUT',
        body: JSON.stringify({
          universityName: pf.universityName || undefined,
          major: pf.major,
          degreeLevel: pf.degreeLevel,
          visaType: pf.visaType,
          programStartDate: new Date(pf.programStartDate).toISOString(),
          programEndDate: new Date(pf.programEndDate).toISOString(),
          usEntryDate: pf.usEntryDate ? new Date(pf.usEntryDate).toISOString() : undefined,
          stemEligible: pf.stemEligible,
        }),
      });
      await refreshMe();
      setProfileSaved(true);
    } catch (e: any) {
      setProfileError(e.message ?? 'Could not save profile.');
    } finally {
      setProfileBusy(false);
    }
  }

  async function remove() {
    await api('/users/me', { method: 'DELETE' });
    await logout();
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Manage your account, academic profile, and data.</p>
      </div>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Your name and login email.</p>
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>First name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
            <div><Label>Last name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input value={me?.email ?? ''} disabled /></div>
          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</Button>
            {saved && <span className="text-sm text-emerald-600">Saved</span>}
          </div>
        </div>
      </Card>

      <SevisIdCard />

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Academic profile</h2>
        <p className="mt-0.5 text-sm text-slate-500">Powers your timeline and auto-generated deadlines.</p>
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <div><Label>University</Label><Input value={pf.universityName} onChange={setP('universityName')} /></div>
          <div><Label>Major / program</Label><Input value={pf.major} onChange={setP('major')} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Degree level</Label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pf.degreeLevel} onChange={setP('degreeLevel')}>
                <option value="BACHELORS">Bachelor&apos;s</option>
                <option value="MASTERS">Master&apos;s</option>
                <option value="PHD">PhD</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <Label>Visa type</Label>
              <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={pf.visaType} onChange={setP('visaType')}>
                <option value="F1">F-1</option>
                <option value="J1">J-1</option>
                <option value="M1">M-1</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Program start</Label><Input type="date" value={pf.programStartDate} onChange={setP('programStartDate')} /></div>
            <div><Label>Program end</Label><Input type="date" value={pf.programEndDate} onChange={setP('programEndDate')} /></div>
          </div>
          <div>
            <Label>Latest U.S. arrival date (optional)</Label>
            <Input type="date" value={pf.usEntryDate} onChange={setP('usEntryDate')} />
            <p className="mt-1 text-xs text-slate-500">
              The most recent date you entered the U.S. — important if you&apos;ve traveled internationally.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={pf.stemEligible}
              onChange={(e) => setPf({ ...pf, stemEligible: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-ink focus:ring-ink/20"
            />
            I have a STEM-designated degree (eligible for 24-month OPT extension)
          </label>
          {profileError && <p className="text-sm text-red-600">{profileError}</p>}
          <div className="flex items-center gap-3">
            <Button onClick={saveProfile} disabled={profileBusy || !pf.major || !pf.programStartDate || !pf.programEndDate}>
              {profileBusy ? 'Saving…' : 'Save changes'}
            </Button>
            {profileSaved && (
              <span className="text-sm text-emerald-600">
                Profile updated — your timeline and deadlines have been recalculated.
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-display text-lg font-semibold text-ink">Session</h2>
        <p className="mt-0.5 text-sm text-slate-500">Sign out of this device.</p>
        <div className="mt-4 border-t border-slate-100 pt-4"><Button variant="ghost" onClick={logout}>Log out</Button></div>
      </Card>

      <Card className="border-red-200 p-6">
        <h2 className="font-display text-lg font-semibold text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600">
          This removes your profile, timeline, deadlines, applications, and documents. This can&apos;t be undone.
        </p>
        <div className="mt-4 border-t border-red-100 pt-4">
          {!confirmDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Type <strong>DELETE</strong> to confirm. This removes everything — your profile, timeline,
                documents, and applications. Cannot be undone.
              </p>
              <Input
                value={deleteInput}
                onChange={(e) => setDeleteInput(e.target.value)}
                placeholder="Type DELETE to confirm"
              />
              <div className="flex gap-2">
                <Button variant="danger" disabled={deleteInput !== 'DELETE'} onClick={remove}>
                  Delete everything
                </Button>
                <Button variant="ghost" onClick={() => { setConfirmDelete(false); setDeleteInput(''); }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
