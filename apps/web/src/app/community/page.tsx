'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Card, Input, Label, Skeleton } from '@/components/ui';
import { showToast } from '@/lib/toast';

interface Post {
  id: string; title: string; content: string; category: string; university: string | null;
  upvotes: number; replyCount: number; author: string; verifiedF1: boolean; createdAt: string;
}

const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'opt', label: 'OPT' },
  { value: 'cpt', label: 'CPT' },
  { value: 'housing', label: 'Housing' },
  { value: 'jobs', label: 'Jobs' },
  { value: 'tax', label: 'Tax' },
  { value: 'general', label: 'General' },
];

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CommunityPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const qc = useQueryClient();
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'latest' | 'top'>('latest');
  const [creating, setCreating] = useState(false);

  const posts = useQuery({
    queryKey: ['community-posts', category, sort],
    queryFn: () => api<{ data: Post[] }>(`/community/posts?category=${category}&sort=${sort === 'top' ? 'top' : 'latest'}`),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[180px_1fr]">
      <aside className="space-y-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`block w-full rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              category === c.value ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {c.label}
          </button>
        ))}
      </aside>

      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-semibold text-ink">Community</h1>
          <div className="flex items-center gap-2">
            <select
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={sort}
              onChange={(e) => setSort(e.target.value as 'latest' | 'top')}
            >
              <option value="latest">Latest</option>
              <option value="top">Most upvoted</option>
            </select>
            <Button onClick={() => setCreating(true)}>Ask the community</Button>
          </div>
        </div>

        {posts.isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        )}

        {!posts.isLoading && (posts.data?.data.length ?? 0) === 0 && (
          <Card className="py-10 text-center text-sm text-slate-500">No posts yet. Be the first to ask something.</Card>
        )}

        <div className="space-y-3">
          {posts.data?.data.map((p) => (
            <Link key={p.id} href={`/community/posts/${p.id}`}>
              <Card className="transition hover:border-ink/30">
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{p.category}</span>
                  {p.university && <span className="text-slate-400">{p.university}</span>}
                  {p.verifiedF1 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Verified F-1</span>}
                </div>
                <h2 className="mt-2 font-display text-base font-semibold text-ink">{p.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.content}</p>
                <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                  <span>{p.author}</span>
                  <span>{timeAgo(p.createdAt)}</span>
                  <span>{p.upvotes} upvotes</span>
                  <span>{p.replyCount} replies</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {creating && (
        <CreatePostModal
          onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['community-posts'] }); }}
        />
      )}
    </div>
  );
}

function CreatePostModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('general');
  const [anonymous, setAnonymous] = useState(true);
  const [error, setError] = useState('');

  const create = useMutation({
    mutationFn: () => api('/community/posts', {
      method: 'POST',
      body: JSON.stringify({ title, content, category, isAnonymous: anonymous }),
    }),
    onSuccess: () => { showToast('Posted to the community'); onCreated(); },
    onError: (e: any) => setError(e.message ?? 'Could not create post.'),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-lg">
        <h2 className="font-display font-semibold text-ink">Ask the community</h2>
        <div className="mt-4 space-y-3">
          <div><Label>Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div>
            <Label>Category</Label>
            <select className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.filter((c) => c.value !== 'all').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <Label>What's going on?</Label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Post anonymously
          </label>
          <p className="text-xs text-slate-400">Be helpful and respectful. Don't share legal advice.</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <Button onClick={() => create.mutate()} disabled={create.isPending || !title.trim() || !content.trim()}>
              {create.isPending ? 'Posting…' : 'Post'}
            </Button>
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
