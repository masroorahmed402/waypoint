import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-paper px-6 text-center">
      <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink">{APP_NAME}</Link>
      <p className="mt-8 font-display text-7xl font-semibold text-beacon">404</p>
      <h1 className="mt-4 text-2xl font-semibold text-ink">This page doesn&apos;t exist.</h1>
      <p className="mt-2 text-sm text-slate-500">The link might be wrong, or this page may have moved.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/dashboard" className="inline-flex items-center justify-center rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-ink-700">
          Go to dashboard
        </Link>
        <Link href="/" className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-ink transition hover:bg-slate-100">
          Go home
        </Link>
      </div>
    </main>
  );
}
