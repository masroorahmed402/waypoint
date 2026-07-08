'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button, Input, Label, Card } from '@/components/ui';
import { SecurityBadge } from '@/components/security-badge';

export default function SettingsPage() {
  return <AppShell><Inner /></AppShell>;
}

const toDateInput = (iso?: string | null) => (iso ? iso.slice(0, 10) : '');

function SectionHeading({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-lg">{icon}</span>
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
    </div>
  );
}

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
    <div>
      <p className="text-sm font-medium text-ink">SEVIS ID</p>
      <p className="mt-0.5 text-xs text-slate-500">Stored encrypted. Enter your password to view it.</p>
      {!revealed ? (
        <div className="mt-2 flex gap-2">
          <Input type="password" placeholder="Your password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && reveal()} />
          <Button onClick={reveal} disabled={busy || !password}>
            {busy ? 'Verifying…' : 'View'}
          </Button>
        </div>
      ) : (
        <div className="mt-2">
          <div className="rounded-lg bg-slate-50 px-4 py-3 font-mono text-lg tracking-widest text-ink">
            {sevisId ?? 'Not stored, upload your I-20 to save it'}
          </div>
          <button onClick={() => { setRevealed(false); setPassword(''); setSevisId(null); }}
            className="mt-2 text-xs text-slate-400 hover:text-slate-600">
            Hide
          </button>
          <div className="mt-2">
            <SecurityBadge variant="card" />
          </div>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Inner() {
  const { me, refreshMe, logout } = useAuth();
  const taxTreaty = useQuery({
    queryKey: ['tax-treaty'],
    queryFn: () => api<{ countryOfCitizenship: string | null; note: string }>('/immigration/tax-treaty'),
    enabled: !!me?.profile,
  });
  const [firstName, setFirstName] = useState(me?.firstName ?? '');
  const [lastName, setLastName] = useState(me?.lastName ?? '');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [emailRemindersOn] = useState(true);

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
        <SectionHeading icon="👤" title="Profile" subtitle="Your name and login email." />
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

      <Card className="p-6">
        <SectionHeading icon="🎓" title="Academic" subtitle="Powers your timeline and auto-generated deadlines." />
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
              The most recent date you entered the U.S., important if you&apos;ve traveled internationally.
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
                Profile updated. Your timeline and deadlines have been recalculated.
              </span>
            )}
          </div>
        </div>
      </Card>

      {taxTreaty.data?.countryOfCitizenship && (
        <Card className="p-6">
          <SectionHeading icon="💰" title="Tax treaty status" subtitle={`Based on your citizenship: ${taxTreaty.data.countryOfCitizenship}`} />
          <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">{taxTreaty.data.note}</p>
          <p className="mt-2 text-xs text-slate-400">Informational only, not tax advice. Consult a tax professional or IRS Publication 901.</p>
        </Card>
      )}

      <Card className="p-6">
        <SectionHeading icon="🔐" title="Security" subtitle="Your SEVIS ID and account access." />
        <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
          <SevisIdCard />
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-ink">Password</p>
            <p className="mt-0.5 text-xs text-slate-500">Changing your password from here is coming soon.</p>
          </div>
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-ink">AI Advisor</p>
            <p className="mt-0.5 text-xs text-slate-500">
              The AI Advisor sends your profile information (name, university, program dates, deadline titles)
              to Groq's API to generate responses. Your documents and encrypted fields (SEVIS ID, passport
              number) are never sent to the AI.
            </p>
          </div>
          <AuditLogSection />
          <div className="border-t border-slate-100 pt-4">
            <Button variant="ghost" onClick={logout}>Log out</Button>
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <SectionHeading icon="🔔" title="Notifications" subtitle="How we reach you about deadlines." />
        <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-ink">Email reminders</p>
              <p className="text-xs text-slate-500">Sent at 90, 30, 7, and 1 day before every deadline.</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${emailRemindersOn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {emailRemindersOn ? 'On' : 'Off'}
            </span>
          </div>
          <div className="flex items-center justify-between opacity-60">
            <div>
              <p className="text-sm font-medium text-ink">Push notifications</p>
              <p className="text-xs text-slate-500">Not available yet.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">Coming soon</span>
          </div>
        </div>
      </Card>

      <Card className="border-red-200 p-6">
        <SectionHeading icon="🗑️" title="Danger zone" subtitle="Delete your account and all associated data." />
        <div className="mt-4 border-t border-red-100 pt-4">
          {!confirmDelete ? (
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete my account</Button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">
                Type <strong>DELETE</strong> to confirm. This removes everything: your profile, timeline,
                documents, and applications. Cannot be undone.
              </p>
              <p className="text-xs text-slate-500">
                Deleting your account permanently removes all encrypted files from our servers.
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

const ACTION_LABEL: Record<string, string> = {
  sevis_id_viewed: 'SEVIS ID viewed',
  document_downloaded: 'Document downloaded',
  document_deleted: 'Document deleted',
  account_deleted: 'Account deleted',
  login_new_device: 'Login from new device',
};

function AuditLogSection() {
  const log = useQuery({
    queryKey: ['audit-log'],
    queryFn: () => api<{ id: string; action: string; createdAt: string }[]>('/users/me/audit-log'),
  });

  if (!log.data?.length) return null;

  return (
    <div className="border-t border-slate-100 pt-4">
      <p className="text-sm font-medium text-ink">Security log</p>
      <p className="mt-0.5 text-xs text-slate-500">Recent sensitive actions on your account.</p>
      <div className="mt-2 space-y-1.5">
        {log.data.slice(0, 10).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between text-xs text-slate-500">
            <span>{ACTION_LABEL[entry.action] ?? entry.action}</span>
            <span>{new Date(entry.createdAt).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
