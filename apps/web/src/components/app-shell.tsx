'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { clsx } from './clsx';
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
  { href: '/documents', label: 'Documents' },
  { href: '/applications', label: 'Applications' },
  { href: '/advisor', label: 'Advisor' },
  { href: '/community', label: 'Community' },
  { href: '/settings', label: 'Settings' },
];

// The 5 highest-traffic destinations, for the mobile bottom tab bar. Documents
// and Community stay reachable on mobile via the hamburger menu below.
const MOBILE_TABS = [
  { href: '/dashboard', label: 'Home', icon: '⊞' },
  { href: '/immigration', label: 'Timeline', icon: '📋' },
  { href: '/advisor', label: 'AI', icon: '✦', highlight: true },
  { href: '/applications', label: 'Jobs', icon: '💼' },
  { href: '/settings', label: 'Settings', icon: '⚙️' },
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
      <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/95 backdrop-blur-sm">
        <div className="relative mx-auto flex h-16 max-w-7xl items-center px-4 sm:px-6">
          {/* LEFT — wordmark, always left-aligned */}
          <div className="flex-shrink-0">
            <Link href="/dashboard" className="font-display text-xl font-semibold text-ink">
              Waypoint <span className="text-beacon">AI</span>
            </Link>
          </div>

          {/* CENTER — nav links, absolutely centered in the header */}
          <nav className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 md:flex">
            {NAV.map((n) =>
              n.href === '/advisor' ? (
                // Advisor — center jewel, always beacon amber
                <Link
                  key={n.href}
                  href="/advisor"
                  className={clsx(
                    'mx-1 flex items-center gap-1.5 rounded-xl px-5 py-2 text-sm font-semibold transition-all',
                    pathname === '/advisor'
                      ? 'scale-105 bg-beacon text-ink shadow-md shadow-beacon/25'
                      : 'bg-beacon text-ink hover:scale-[1.02] hover:bg-beacon-600 hover:shadow-md hover:shadow-beacon/20',
                  )}
                >
                  <span>✦</span>
                  <span>{n.label}</span>
                </Link>
              ) : (
                // Regular nav link
                <Link
                  key={n.href}
                  href={n.href}
                  className={clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    pathname === n.href ? 'bg-slate-100 text-ink' : 'text-slate-500 hover:bg-slate-50 hover:text-ink',
                  )}
                >
                  {n.label}
                </Link>
              ),
            )}
          </nav>

          {/* RIGHT — user info, always right-aligned */}
          <div className="ml-auto flex flex-shrink-0 items-center gap-1">
            <NotificationBell />
            <div className="hidden items-center gap-3 md:flex">
              <div className="h-5 w-px bg-slate-200" />
              <span className="whitespace-nowrap text-sm font-medium text-slate-700">
                {me.firstName} {me.lastName || ''}
              </span>
              <button onClick={logout} className="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-ink">
                Log out
              </button>
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

      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 sm:px-6 md:pb-6">{children}</main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur-sm md:hidden">
        <div className="flex">
          {MOBILE_TABS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-1 flex-col items-center gap-0.5 py-3 text-center transition-colors',
                pathname === item.href ? (item.highlight ? 'text-beacon' : 'text-ink') : 'text-slate-400',
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <ToastHost />
    </div>
  );
}
