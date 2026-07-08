'use client';
import { useState, useRef, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import AppShell from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { APP_NAME } from '@/lib/brand';
import { markAdvisorUsed } from '@/lib/engagement';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTED = [
  'What should I do before my program ends?',
  'Am I eligible for OPT?',
  'How much CPT can I use before losing OPT?',
  'Can I travel internationally right now?',
  'Draft an email to my DSO about OPT',
  'What happens during the 60-day grace period?',
];

export default function AdvisorPage() {
  return <AppShell><AdvisorInner /></AppShell>;
}

function AdvisorInner() {
  const { me } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(question: string) {
    if (!question.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: question };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const res = await api<{ answer: string; disclaimer: string }>('/immigration/ask', {
        method: 'POST',
        body: JSON.stringify({ question, history }),
      });
      setMessages((prev) => [...prev, { role: 'assistant', content: res.answer }]);
      markAdvisorUsed();
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }

  const hasProfile = !!me?.profile;

  return (
    <div className="flex h-[calc(100vh-80px)] flex-col">
      <div className="mb-4">
        <h1 className="font-display text-2xl font-semibold text-ink">Immigration Advisor</h1>
        <p className="text-sm text-slate-500">Personalized to your timeline — powered by AI</p>
      </div>

      {!hasProfile && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">Complete your onboarding first so the advisor knows your actual dates and situation.</p>
        </Card>
      )}

      {messages.length === 0 && (
        <div className="mb-4">
          <p className="mb-3 text-sm text-slate-500">Try asking:</p>
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
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                  Not legal advice — confirm with your DSO
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
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
          {APP_NAME} AI knows your actual program dates and deadlines
        </p>
      </div>
    </div>
  );
}
