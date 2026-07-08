import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink">{APP_NAME}</Link>

      <div className="mt-8 animate-float">
        <svg width="72" height="72" viewBox="0 0 80 80" fill="none">
          <path d="M40 4C24 4 12 16 12 32c0 20 28 44 28 44s28-24 28-44C68 16 56 4 40 4Z" fill="#e6a53a" fillOpacity="0.2" stroke="#e6a53a" strokeWidth="2.5" />
          <text x="40" y="42" textAnchor="middle" fontSize="28" fontWeight="600" fill="#16263f">?</text>
        </svg>
      </div>

      <p className="mt-6 font-display text-7xl font-semibold text-beacon">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-ink">This page doesn&apos;t exist.</h1>
      <p className="mt-2 text-sm text-slate-500">The link might be wrong, or this page may have moved.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700">
          Dashboard
        </Link>
        <Link href="/immigration" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100">
          Immigration
        </Link>
        <Link href="/advisor" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100">
          Advisor
        </Link>
      </div>
    </main>
  );
}
