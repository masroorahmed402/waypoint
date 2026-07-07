'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { clsx } from './clsx';
import { APP_NAME } from '@/lib/brand';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/immigration', label: 'Immigration' },
  { href: '/documents', label: 'Documents' },
  { href: '/applications', label: 'Applications' },
  { href: '/settings', label: 'Settings' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  if (loading || !me) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading…</main>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight text-ink">{APP_NAME}</Link>
            <nav className="flex gap-1">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href}
                  className={clsx('rounded-md px-3 py-1.5 text-sm',
                    pathname === n.href ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-500 hover:text-slate-900')}>
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{me.firstName}</span>
            <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900">Log out</button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
