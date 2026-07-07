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

function Inner() {
  const { me, refreshMe, logout } = useAuth();
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const profile = me?.profile;
  const [pf, setPf] = useState({
    universityName: profile?.universityName ?? profile?.university?.name ?? '',
    major: profile?.major ?? '',
    degreeLevel: profile?.degreeLevel ?? 'MASTERS',
    visaType: profile?.visaType ?? 'F1',
    programStartDate: toDateInput(profile?.programStartDate),
    programEndDate: toDateInput(profile?.programEndDate),
    usEntryDate: toDateInput(profile?.usEntryDate),
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
    <div className="max-w-lg space-y-6">
      <h1 className="text-2xl font-semibold">Settings</h1>

      <Card>
        <h2 className="font-display font-semibold">Profile</h2>
        <div className="mt-4 space-y-3">
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

      <Card>
        <h2 className="font-display font-semibold">Academic profile</h2>
        <div className="mt-4 space-y-3">
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
          <div><Label>U.S. entry date (optional)</Label><Input type="date" value={pf.usEntryDate} onChange={setP('usEntryDate')} /></div>
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

      <Card>
        <h2 className="font-display font-semibold">Session</h2>
        <p className="mt-1 text-sm text-slate-500">Sign out of this device.</p>
        <div className="mt-3"><Button variant="ghost" onClick={logout}>Log out</Button></div>
      </Card>

      <Card className="border-red-200">
        <h2 className="font-display font-semibold text-red-700">Delete account</h2>
        <p className="mt-1 text-sm text-slate-600">
          This removes your profile, timeline, deadlines, applications, and documents. This can&apos;t be undone.
        </p>
        {!confirmDelete ? (
          <div className="mt-3"><Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button></div>
        ) : (
          <div className="mt-3 flex items-center gap-3">
            <span className="text-sm font-medium">Are you sure?</span>
            <Button variant="danger" onClick={remove}>Yes, delete everything</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
