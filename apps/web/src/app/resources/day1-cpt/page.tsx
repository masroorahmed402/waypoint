'use client';
import Link from 'next/link';
import AppShell from '@/components/app-shell';
import { Card } from '@/components/ui';

const RISK_LABEL: Record<string, string> = { high: 'High scrutiny', medium: 'Medium scrutiny', low: 'Low scrutiny' };
const RISK_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-emerald-100 text-emerald-700',
};

const DAY1_CPT_UNIVERSITIES: { name: string; state: string; notes: string; risk: 'high' | 'medium' | 'low' }[] = [
  { name: 'University of the Cumberlands', state: 'KY', notes: 'Popular for MS CS programs', risk: 'high' },
  { name: 'Trine University', state: 'IN', notes: 'Large international enrollment', risk: 'high' },
  { name: 'Sam Houston State University', state: 'TX', notes: '', risk: 'high' },
  { name: 'Westcliff University', state: 'CA', notes: '', risk: 'high' },
  { name: 'National American University', state: 'SD', notes: 'Closed in 2022', risk: 'high' },
  { name: 'Silicon Valley University', state: 'CA', notes: '', risk: 'high' },
  { name: 'Sofia University', state: 'CA', notes: '', risk: 'medium' },
  { name: 'NEIT, New England Institute of Technology', state: 'RI', notes: '', risk: 'medium' },
  { name: 'Campbellsville University', state: 'KY', notes: '', risk: 'medium' },
  { name: 'Lindenwood University', state: 'MO', notes: '', risk: 'medium' },
  { name: 'Slippery Rock University', state: 'PA', notes: '', risk: 'medium' },
  { name: 'Point Park University', state: 'PA', notes: '', risk: 'medium' },
  { name: 'Eastern Kentucky University', state: 'KY', notes: '', risk: 'medium' },
  { name: 'Full Sail University', state: 'FL', notes: '', risk: 'medium' },
  { name: 'Webster University', state: 'MO', notes: 'Long-established, multiple campuses', risk: 'low' },
  { name: 'Illinois Institute of Technology', state: 'IL', notes: 'Established CPT partnerships', risk: 'low' },
  { name: 'DePaul University', state: 'IL', notes: 'Standard CPT after 1 year enrollment', risk: 'low' },
  { name: 'University of the Potomac', state: 'DC', notes: '', risk: 'medium' },
  { name: 'Clark University', state: 'MA', notes: '', risk: 'low' },
  { name: 'Saint Peter’s University', state: 'NJ', notes: '', risk: 'medium' },
  { name: 'Monroe College', state: 'NY', notes: '', risk: 'medium' },
  { name: 'Trinity International University', state: 'IL', notes: '', risk: 'medium' },
];

export default function Day1CptPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <Link href="/immigration" className="text-sm text-slate-500 hover:text-ink">&larr; Back to Immigration</Link>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">Day 1 CPT universities</h1>
          <p className="mt-1 text-sm text-slate-500">
            A reference list of schools known for offering Curricular Practical Training authorization
            starting on day one of enrollment, rather than after the standard one full academic year.
          </p>
        </div>

        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">
            This information is for educational purposes only. Consult an immigration attorney before
            choosing a university specifically for CPT benefits. USCIS has increased scrutiny of Day 1
            CPT programs, and some schools on this list have since closed or changed their policies.
          </p>
        </Card>

        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">University</th>
                <th className="px-5 py-3 font-medium">State</th>
                <th className="px-5 py-3 font-medium">Risk level</th>
                <th className="px-5 py-3 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {DAY1_CPT_UNIVERSITIES.map((u) => (
                <tr key={u.name} className="border-b border-slate-100 last:border-0">
                  <td className="px-5 py-3 font-medium text-ink">{u.name}</td>
                  <td className="px-5 py-3 text-slate-500">{u.state}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RISK_CLASS[u.risk]}`}>
                      {RISK_LABEL[u.risk]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{u.notes || 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </AppShell>
  );
}
