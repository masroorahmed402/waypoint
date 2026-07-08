'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import AppShell from '@/components/app-shell';
import { Button, Card, Skeleton } from '@/components/ui';
import { showToast } from '@/lib/toast';

interface Reply {
  id: string; content: string; upvotes: number; author: string; verifiedF1: boolean; createdAt: string;
}
interface PostDetail {
  id: string; title: string; content: string; category: string; university: string | null;
  upvotes: number; author: string; verifiedF1: boolean; createdAt: string; replies: Reply[];
}

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

export default function PostDetailPage() {
  return <AppShell><Inner /></AppShell>;
}

function Inner() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [reply, setReply] = useState('');
  const [anonymous, setAnonymous] = useState(true);

  const post = useQuery({ queryKey: ['community-post', id], queryFn: () => api<PostDetail>(`/community/posts/${id}`) });

  const upvote = useMutation({
    mutationFn: () => api(`/community/posts/${id}/upvote`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community-post', id] }),
  });

  const sendReply = useMutation({
    mutationFn: () => api(`/community/posts/${id}/replies`, { method: 'POST', body: JSON.stringify({ content: reply, isAnonymous: anonymous }) }),
    onSuccess: () => { setReply(''); showToast('Reply posted'); qc.invalidateQueries({ queryKey: ['community-post', id] }); },
  });

  if (post.isLoading) return <Skeleton className="h-64" />;
  if (!post.data) return <p className="text-sm text-slate-500">Post not found.</p>;

  const p = post.data;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/community" className="text-sm text-slate-500 hover:text-ink">&larr; Back to community</Link>

      <Card>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600">{p.category}</span>
          {p.university && <span className="text-slate-400">{p.university}</span>}
          {p.verifiedF1 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Verified F-1</span>}
        </div>
        <h1 className="mt-2 font-display text-xl font-semibold text-ink">{p.title}</h1>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{p.content}</p>
        <div className="mt-4 flex items-center gap-4 text-xs text-slate-400">
          <span>{p.author}</span>
          <span>{timeAgo(p.createdAt)}</span>
          <button onClick={() => upvote.mutate()} className="font-medium text-slate-500 hover:text-ink">
            ▲ {p.upvotes} upvotes
          </button>
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink">{p.replies.length} {p.replies.length === 1 ? 'reply' : 'replies'}</p>
        {p.replies.map((r) => (
          <Card key={r.id}>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-medium text-slate-600">{r.author}</span>
              {r.verifiedF1 && <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-700">Verified F-1</span>}
              <span>{timeAgo(r.createdAt)}</span>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{r.content}</p>
          </Card>
        ))}
      </div>

      <Card>
        <textarea
          className="min-h-[80px] w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
          placeholder="Add a reply…"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="mt-2 flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} className="h-4 w-4 rounded border-slate-300" />
            Reply anonymously
          </label>
          <Button onClick={() => sendReply.mutate()} disabled={sendReply.isPending || !reply.trim()}>
            {sendReply.isPending ? 'Posting…' : 'Reply'}
          </Button>
        </div>
      </Card>
    </div>
  );
}
