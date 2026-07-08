'use client';
import { useState, useRef, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, apiBlob } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';
import { markAdvisorUsed } from '@/lib/engagement';
import { showToast } from '@/lib/toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

const SUGGESTED = [
  'What should I do before my program ends?',
  'Am I eligible for OPT?',
  'How much CPT can I use before losing OPT?',
  'Can I travel internationally right now?',
  'Draft an email to my DSO about OPT',
  'What happens during the 60-day grace period?',
];

const FOLLOW_UPS: { match: RegExp; questions: string[] }[] = [
  { match: /opt/i, questions: ['When does my OPT filing window close?', 'What documents do I need for OPT?'] },
  { match: /cpt/i, questions: ['Will more CPT affect my OPT eligibility?', 'How is part-time CPT counted?'] },
  { match: /travel/i, questions: ['What documents do I need to re-enter the U.S.?', 'How long can I be outside the U.S.?'] },
  { match: /dso|email/i, questions: ['What else should I ask my DSO?', 'How long does a DSO response usually take?'] },
];

const CONVERSATIONS_KEY = 'waypoint_advisor_conversations';

function loadConversations(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(CONVERSATIONS_KEY) ?? '[]'); } catch { return []; }
}

function saveConversations(convos: Conversation[]) {
  window.localStorage.setItem(CONVERSATIONS_KEY, JSON.stringify(convos));
}

export default function AdvisorPage() {
  return <AppShell><Suspense fallback={null}><AdvisorInner /></Suspense></AppShell>;
}

function AdvisorInner() {
  const { me } = useAuth();
  const searchParams = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setConversations(loadConversations());
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(nextMessages: Message[]) {
    if (nextMessages.length === 0) return;
    const id = activeId ?? crypto.randomUUID();
    if (!activeId) setActiveId(id);
    const title = nextMessages[0].content.slice(0, 48);
    const next = conversations.filter((c) => c.id !== id);
    next.unshift({ id, title, messages: nextMessages, updatedAt: Date.now() });
    const trimmed = next.slice(0, 20);
    setConversations(trimmed);
    saveConversations(trimmed);
  }

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: question };
    const withUser = [...messages, userMsg];
    setMessages(withUser);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api<{ answer: string; disclaimer: string }>('/immigration/ask', {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      });
      const withAnswer = [...withUser, { role: 'assistant' as const, content: res.answer }];
      setMessages(withAnswer);
      persist(withAnswer);
      markAdvisorUsed();
    } catch {
      const withError = [...withUser, { role: 'assistant' as const, content: 'Sorry, something went wrong. Please try again.' }];
      setMessages(withError);
      persist(withError);
    } finally {
      setLoading(false);
    }
  }

  function newConversation() {
    setMessages([]);
    setActiveId(null);
    setInput('');
  }

  function openConversation(c: Conversation) {
    setMessages(c.messages);
    setActiveId(c.id);
  }

  function shareConversation() {
    const text = messages.map((m) => `${m.role === 'user' ? 'You' : APP_NAME}: ${m.content}`).join('\n\n');
    navigator.clipboard.writeText(text);
    showToast('Conversation copied to clipboard');
  }

  async function exportDeadlines() {
    try {
      const blob = await apiBlob('/immigration/deadlines/export.ics');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'waypoint-deadlines.ics';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Could not export deadlines');
    }
  }

  const hasProfile = !!me?.profile;
  const lastUserQuestion = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const contextualFollowUps = FOLLOW_UPS.find((f) => f.match.test(lastUserQuestion))?.questions ?? [];

  const QUICK_ACTIONS = [
    { icon: '📧', label: 'Draft DSO email', action: () => send('Draft an email to my DSO about OPT') },
    { icon: '📅', label: 'Export deadlines', action: exportDeadlines },
    { icon: '🔍', label: 'Check OPT eligibility', action: () => send('Am I eligible for OPT and when does my window open?') },
    { icon: '📊', label: 'My CPT summary', action: () => send('Give me a summary of my CPT usage so far') },
  ];

  return (
    <div className="flex h-[calc(100vh-80px)] gap-4">
      {/* sidebar */}
      <div className="hidden w-56 shrink-0 flex-col border-r border-slate-200 pr-4 lg:flex">
        <Button variant="ghost" className="mb-3 w-full text-sm" onClick={newConversation}>+ New conversation</Button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 && <p className="text-xs text-slate-400">No past conversations yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={`block w-full truncate rounded-lg px-2.5 py-2 text-left text-xs ${
                activeId === c.id ? 'bg-slate-100 font-medium text-ink' : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold text-ink">Immigration Advisor</h1>
            <p className="text-sm text-slate-500">Personalized to your timeline, powered by AI</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" className="text-xs" onClick={shareConversation}>Share conversation</Button>
          )}
        </div>

        {!hasProfile && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800">Complete your onboarding first so the advisor knows your actual dates and situation.</p>
          </Card>
        )}

        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.label}
              onClick={a.action}
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-ink shadow-sm transition hover:bg-slate-50"
            >
              {a.icon} {a.label}
            </button>
          ))}
        </div>

        {messages.length === 0 && (
          <div className="mb-4">
            <p className="mb-3 text-sm text-slate-500">
              Hi {me?.firstName}! I&apos;m your {APP_NAME} advisor.
              {hasProfile && me?.profile && ` I know you're studying ${me.profile.major} at ${me.profile.university?.name ?? me.profile.universityName ?? 'your university'} and your program ends ${new Date(me.profile.programEndDate).toLocaleDateString()}.`}
              {' '}What can I help you with?
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:border-ink hover:bg-slate-100"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto pb-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-beacon text-xs font-bold text-ink">W</span>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                  m.role === 'user'
                    ? 'rounded-br-sm bg-ink text-white'
                    : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800 shadow-sm'
                }`}
              >
                {m.content}
                {m.role === 'assistant' && (
                  <p className="mt-2 border-t border-amber-100 pt-1 text-xs text-amber-600">
                    Not legal advice, confirm with your DSO
                  </p>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-end gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-beacon text-xs font-bold text-ink">W</span>
              <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                  <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          {!loading && contextualFollowUps.length > 0 && (
            <div className="flex flex-wrap gap-2 pl-9">
              {contextualFollowUps.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="rounded-full border border-beacon/40 bg-beacon/10 px-3 py-1.5 text-xs text-ink transition hover:bg-beacon/20"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask anything about your visa, OPT, CPT, or immigration timeline..."
              className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <Button onClick={() => send(input)} disabled={loading || !input.trim()}>
              Send
            </Button>
          </div>
          <p className="mt-2 text-center text-xs text-slate-400">
            {APP_NAME} knows your actual program dates and deadlines
          </p>
        </div>
      </div>
    </div>
  );
}
