'use client';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card } from './ui';

interface ChecklistItem {
  key: string;
  title: string;
  description: string;
  category: string;
  priority: number;
  link: string | null;
  completedAt: string | null;
}

const CATEGORY_COLOR: Record<string, string> = {
  arrival: 'bg-blue-100 text-blue-700',
  documents: 'bg-purple-100 text-purple-700',
  finance: 'bg-emerald-100 text-emerald-700',
  immigration: 'bg-amber-100 text-amber-700',
  health: 'bg-pink-100 text-pink-700',
  academic: 'bg-indigo-100 text-indigo-700',
  waypoint: 'bg-slate-200 text-slate-700',
};

/** Program-start-based gating: expanded by default for new students (<6 months in), collapsed for everyone else. */
export default function ArrivalChecklist({ programStartDate }: { programStartDate: string }) {
  const isNewStudent = Date.now() - new Date(programStartDate).getTime() < 183 * 86_400_000;
  const [expanded, setExpanded] = useState(isNewStudent);
  const qc = useQueryClient();

  const { data } = useQuery({
    queryKey: ['checklist'],
    queryFn: () => api<ChecklistItem[]>('/checklist'),
  });

  const toggle = useMutation({
    mutationFn: ({ key, done }: { key: string; done: boolean }) =>
      done
        ? api(`/checklist/${key}/complete`, { method: 'DELETE' })
        : api(`/checklist/${key}/complete`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['checklist'] }),
  });

  const items = data ?? [];
  const doneCount = items.filter((i) => i.completedAt).length;
  const total = items.length;

  if (!expanded) {
    return (
      <Card className="flex items-center justify-between">
        <div>
          <h2 className="font-display font-semibold text-ink">Arrival checklist</h2>
          <p className="text-xs text-slate-500">{doneCount} of {total} completed</p>
        </div>
        <button onClick={() => setExpanded(true)} className="text-sm font-medium text-ink hover:underline">
          View arrival checklist
        </button>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold text-ink">Arrival checklist</h2>
        {!isNewStudent && (
          <button onClick={() => setExpanded(false)} className="text-xs font-medium text-slate-500 hover:underline">
            Collapse
          </button>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-500">{doneCount} of {total} completed</p>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full rounded-full bg-beacon transition-all"
          style={{ width: total ? `${(doneCount / total) * 100}%` : '0%' }}
        />
      </div>
      <div className="mt-4 space-y-3">
        {items
          .slice()
          .sort((a, b) => a.priority - b.priority)
          .map((item) => {
            const done = !!item.completedAt;
            return (
              <div key={item.key} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggle.mutate({ key: item.key, done })}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-ink focus:ring-ink/20"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`text-sm font-medium ${done ? 'text-slate-400 line-through' : 'text-ink'}`}>
                      {item.title}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${CATEGORY_COLOR[item.category] ?? 'bg-slate-100 text-slate-600'}`}>
                      {item.category}
                    </span>
                  </div>
                  <p className={`mt-0.5 text-xs leading-relaxed ${done ? 'text-slate-300' : 'text-slate-500'}`}>
                    {item.description}
                  </p>
                  {item.link && !done && (
                    <a
                      href={item.link}
                      target={item.link.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-xs font-medium text-ink hover:underline"
                    >
                      {item.link.startsWith('http') ? 'Learn more ↗' : 'Go →'}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </Card>
  );
}
