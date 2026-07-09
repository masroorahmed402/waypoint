'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatDeadline } from '@/lib/format-date';
import { useAuth } from '@/lib/auth-context';

interface Deadline { id: string; title: string; dueDate: string; type: string; source: string }

// Unscoped legacy key — see advisor/page.tsx for the same issue with conversation history.
const LEGACY_UNSCOPED_READ_KEY = 'waypoint_read_deadline_ids';
const readIdsKey = (userId: string) => `waypoint_read_deadline_ids:${userId}`;
const daysUntil = (iso: string) => Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);

function loadReadIds(userId: string): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(readIdsKey(userId)) ?? '[]'));
  } catch {
    return new Set();
  }
}

export default function NotificationBell() {
  const { me } = useAuth();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['deadlines', 'upcoming'],
    queryFn: () => api<Deadline[]>('/immigration/deadlines?status=upcoming'),
  });

  useEffect(() => {
    window.localStorage.removeItem(LEGACY_UNSCOPED_READ_KEY);
    setReadIds(me?.id ? loadReadIds(me.id) : new Set());
  }, [me?.id]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const upcoming = (data ?? []).filter((d) => daysUntil(d.dueDate) <= 30);
  const unreadCount = upcoming.filter((d) => !readIds.has(d.id)).length;

  function markAllRead() {
    if (!me?.id) return;
    const next = new Set(readIds);
    upcoming.forEach((d) => next.add(d.id));
    setReadIds(next);
    window.localStorage.setItem(readIdsKey(me.id), JSON.stringify(Array.from(next)));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
      >
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm font-semibold text-ink">Deadlines</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-ink hover:underline">Mark all as read</button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {upcoming.length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-slate-400">No deadlines in the next 30 days.</p>
            ) : (
              upcoming.map((d) => {
                const n = daysUntil(d.dueDate);
                const unread = !readIds.has(d.id);
                const dot = n <= 7 ? 'bg-red-500' : n <= 30 ? 'bg-amber-500' : 'bg-slate-300';
                return (
                  <Link
                    key={d.id}
                    href="/immigration"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm hover:bg-slate-50 ${unread ? 'font-medium text-ink' : 'text-slate-500'}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="flex-1 truncate">{d.title}</span>
                    <span className="shrink-0 text-xs text-slate-400">{formatDeadline(d.dueDate)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
