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
  'Practice with me for a visa interview',
  "How do I answer 'are you authorized to work in the US?'",
];

const FOLLOW_UPS: { match: RegExp; questions: string[] }[] = [
  { match: /opt/i, questions: ['When does my OPT filing window close?', 'What documents do I need for OPT?'] },
  { match: /cpt/i, questions: ['Will more CPT affect my OPT eligibility?', 'How is part-time CPT counted?'] },
  { match: /travel/i, questions: ['What documents do I need to re-enter the U.S.?', 'How long can I be outside the U.S.?'] },
  { match: /dso|email/i, questions: ['What else should I ask my DSO?', 'How long does a DSO response usually take?'] },
];

// Unscoped legacy key from before conversations were scoped per-user — every
// account on the same browser read and wrote this same key, so a new user
// signing in on a shared/reused browser saw the previous user's full AI
// conversation history. Kept only so it can be purged below.
const LEGACY_UNSCOPED_CONVERSATIONS_KEY = 'waypoint_advisor_conversations';
const conversationsKey = (userId: string) => `waypoint_advisor_conversations:${userId}`;

function loadConversations(userId: string): Conversation[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(window.localStorage.getItem(conversationsKey(userId)) ?? '[]'); } catch { return []; }
}

function saveConversations(userId: string, convos: Conversation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(conversationsKey(userId), JSON.stringify(convos));
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
    // Purge the old unscoped key so any conversation history left over from
    // before this fix can't leak to whichever account loads this page next.
    if (typeof window !== 'undefined') window.localStorage.removeItem(LEGACY_UNSCOPED_CONVERSATIONS_KEY);
    if (!me?.id) return;
    setConversations(loadConversations(me.id));
    // A different user signing in without a full page reload (e.g. via SPA
    // navigation after logout) must not keep the previous user's messages
    // in memory — reset the active thread whenever the logged-in user changes.
    setMessages([]);
    setActiveId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q) send(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(nextMessages: Message[]) {
    if (nextMessages.length === 0 || !me?.id) return;
    const id = activeId ?? crypto.randomUUID();
    if (!activeId) setActiveId(id);
    const title = nextMessages[0].content.slice(0, 48);
    const next = conversations.filter((c) => c.id !== id);
    next.unshift({ id, title, messages: nextMessages, updatedAt: Date.now() });
    const trimmed = next.slice(0, 20);
    setConversations(trimmed);
    saveConversations(me.id, trimmed);
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
      if (me?.id) markAdvisorUsed(me.id);
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
    // Negative margins cancel AppShell's <main> padding (including the pb-24
    // reserved for the mobile bottom tab bar) so this page can own its own
    // exact h-[calc(100vh-4rem)] — 4rem matches the sticky header's h-16 —
    // instead of double-padding and overflowing the actual viewport.
    <div className="-mx-4 -mt-6 -mb-24 flex h-[calc(100vh-4rem)] overflow-hidden sm:-mx-6 md:-mb-6">
      {/* sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-100 bg-slate-50/50 p-4 lg:flex">
        <button
          onClick={newConversation}
          className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        >
          + New conversation
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {conversations.length === 0 && <p className="text-xs text-slate-400">No past conversations yet.</p>}
          {conversations.map((c) => (
            <button
              key={c.id}
              onClick={() => openConversation(c)}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-sm transition ${
                activeId === c.id ? 'bg-ink text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {c.title || 'New conversation'}
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h1 className="font-display text-xl font-semibold text-ink">Immigration Advisor</h1>
            <p className="text-sm text-slate-500">Personalized to your timeline, powered by AI</p>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" className="text-xs" onClick={shareConversation}>Share conversation</Button>
          )}
        </div>

        {!hasProfile && (
          <div className="flex-shrink-0 px-6 pt-4">
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">Complete your onboarding first so the advisor knows your actual dates and situation.</p>
            </Card>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-shrink-0 flex-wrap gap-2 border-b border-slate-100 px-6 py-3">
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

        {/* Messages — the ONLY scrollable area */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <p className="mb-6 max-w-lg text-base text-slate-700">
                Hi {me?.firstName}! I&apos;m your {APP_NAME} advisor.
                {hasProfile && me?.profile && ` I know you're studying ${me.profile.major} at ${me.profile.university?.name ?? me.profile.universityName ?? 'your university'} and your program ends ${new Date(me.profile.programEndDate).toLocaleDateString()}.`}
                {' '}What can I help you with?
              </p>
              <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                {SUGGESTED.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:border-ink hover:bg-slate-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex items-end gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-beacon text-xs font-bold text-ink">W</span>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      m.role === 'user'
                        ? 'rounded-br-sm bg-ink text-white'
                        : 'rounded-bl-sm border border-slate-100 bg-white text-slate-800'
                    }`}
                  >
                    {m.content}
                    {m.role === 'assistant' && (
                      <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-amber-600">
                        Not legal advice — confirm with your DSO
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
          )}
        </div>

        {/* Input — always pinned to bottom */}
        <div className="flex-shrink-0 border-t border-slate-100 bg-white px-6 py-4">
          <div className="mx-auto flex max-w-3xl gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send(input)}
              placeholder="Ask anything about your visa, OPT, CPT, or immigration timeline..."
              className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-ink focus:ring-2 focus:ring-ink/10"
            />
            <VoiceInput onResult={(text) => { setInput(text); send(text); }} />
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

function VoiceInput({ onResult }: { onResult: (text: string) => void }) {
  const [listening, setListening] = useState(false);

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input not supported in this browser. Try Chrome.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };

    recognition.start();
  }

  return (
    <button
      onClick={startListening}
      type="button"
      title={listening ? 'Listening…' : 'Voice input'}
      className={`rounded-xl px-4 py-3 text-sm transition ${
        listening ? 'animate-pulse bg-red-100 text-red-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`}
    >
      🎤
    </button>
  );
}
