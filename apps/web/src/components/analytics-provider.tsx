'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initPosthog, track } from '@/lib/posthog';

export default function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  useEffect(() => { initPosthog(); }, []);
  useEffect(() => { if (pathname) track('$pageview', { path: pathname }); }, [pathname]);
  return <>{children}</>;
}
