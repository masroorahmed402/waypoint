'use client';
import posthog from 'posthog-js';

let inited = false;

/** Idempotent init. No-ops if no key is set, so the app runs fine without analytics. */
export function initPosthog() {
  if (inited || typeof window === 'undefined') return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
    autocapture: false,            // sensitive app — never auto-capture input/click contents
    capture_pageview: false,       // we capture pageviews manually (below)
    disable_session_recording: true,
    persistence: 'localStorage+cookie',
  });
  inited = true;
}

export function track(event: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  initPosthog();
  posthog.capture(event, props);
}

export function identify(id: string, props?: Record<string, unknown>) {
  if (typeof window === 'undefined' || !process.env.NEXT_PUBLIC_POSTHOG_KEY) return;
  initPosthog();
  posthog.identify(id, props);
}
