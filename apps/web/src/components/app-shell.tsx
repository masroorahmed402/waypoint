'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { clsx } from './clsx';
import { APP_NAME } from '@/lib/brand';
import NotificationBell from './notification-bell';
import ToastHost from './toast-host';

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z" />
    </svg>
  );
}

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/immigration', label: 'Immigration' },
  { href: '/advisor', label: 'Advisor' },
  { href: '/documents', label: 'Documents' },
  { href: '/applications', label: 'Applications' },
  { href: '/community', label: 'Community' },
  { href: '/settings', label: 'Settings' },
];

const MOBILE_TABS = [
  { href: '/dashboard', label: 'Dashboard', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="5" rx="1.5" /><rect x="13" y="12" width="8" height="9" rx="1.5" /><rect x="3" y="15" width="8" height="6" rx="1.5" /></svg>
  ) },
  { href: '/immigration', label: 'Immigration', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="5" cy="6" r="1.8" /><circle cx="12" cy="18" r="1.8" /><circle cx="19" cy="10" r="1.8" /><path d="M5 8v4a2 2 0 0 0 2 2h3M14 18h3a2 2 0 0 0 2-2v-2" strokeLinecap="round" /></svg>
  ) },
  { href: '/advisor', label: 'Advisor', icon: <SparkleIcon /> },
  { href: '/applications', label: 'Applications', icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7a2 2 0 0 1 2-2h3l1-2h6l1 2h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /><path d="M3 11h18" /></svg>
  ) },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { me, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !me) router.replace('/login');
  }, [loading, me, router]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  if (loading || !me) {
    return <main className="flex min-h-screen items-center justify-center text-slate-500">Loading…</main>;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="font-display text-lg font-semibold tracking-tight text-ink">{APP_NAME}</Link>
            <nav className="hidden gap-1 md:flex">
              {NAV.map((n) =>
                n.href === '/advisor' ? (
                  <Link key={n.href} href={n.href}
                    className={clsx('flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium transition',
                      pathname === n.href ? 'bg-beacon text-ink' : 'bg-beacon/20 text-beacon-700 hover:bg-beacon/30')}>
                    <SparkleIcon /> {n.label}
                  </Link>
                ) : (
                  <Link key={n.href} href={n.href}
                    className={clsx('rounded-t-md border-b-2 px-3 py-1.5 text-sm transition-colors',
                      pathname === n.href
                        ? 'border-beacon font-medium text-slate-900'
                        : 'border-transparent text-slate-500 hover:border-slate-200 hover:text-slate-900')}>
                    {n.label}
                  </Link>
                ),
              )}
            </nav>
          </div>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <div className="hidden items-center gap-3 md:flex">
              <span className="ml-2 text-sm text-slate-500">{me.firstName}</span>
              <button onClick={logout} className="text-sm text-slate-500 hover:text-slate-900">Log out</button>
            </div>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Toggle menu"
              className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 md:hidden"
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" /></svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" /></svg>
              )}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
            {NAV.map((n) =>
              n.href === '/advisor' ? (
                <Link key={n.href} href={n.href}
                  className={clsx('my-1 flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-medium',
                    pathname === n.href ? 'bg-beacon text-ink' : 'bg-beacon/20 text-beacon-700')}>
                  <SparkleIcon /> {n.label}
                </Link>
              ) : (
                <Link key={n.href} href={n.href}
                  className={clsx('block rounded-md px-3 py-2.5 text-sm',
                    pathname === n.href ? 'bg-slate-100 font-medium text-slate-900' : 'text-slate-600 hover:text-slate-900')}>
                  {n.label}
                </Link>
              ),
            )}
            <div className="mt-1 flex items-center justify-between border-t border-slate-100 px-3 pt-3">
              <span className="text-sm text-slate-500">{me.firstName}</span>
              <button onClick={logout} className="text-sm font-medium text-slate-500 hover:text-slate-900">Log out</button>
            </div>
          </nav>
        )}
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 pb-20 sm:px-6 sm:py-8 md:pb-8">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white/95 backdrop-blur md:hidden">
        {MOBILE_TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium',
                active ? 'text-ink' : 'text-slate-400',
              )}
            >
              <span className={active ? 'text-beacon-600' : ''}>{t.icon}</span>
              {t.label}
            </Link>
          );
        })}
      </nav>
      <ToastHost />
    </div>
  );
}
