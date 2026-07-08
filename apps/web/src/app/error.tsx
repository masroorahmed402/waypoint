'use client';
import { APP_NAME } from '@/lib/brand';

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <span className="font-display text-2xl font-semibold tracking-tight text-ink">{APP_NAME}</span>
      <p className="mt-8 text-4xl">⚠️</p>
      <h1 className="mt-4 text-2xl font-semibold text-ink">Something went wrong.</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        We hit an unexpected error. It&apos;s not your fault — try refreshing the page.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          onClick={reset}
          className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700"
        >
          Try refreshing the page
        </button>
        <a
          href="mailto:support@waypoint.app"
          className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100"
        >
          Report this issue
        </a>
      </div>
    </main>
  );
}
