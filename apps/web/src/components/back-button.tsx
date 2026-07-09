'use client';
import { useRouter } from 'next/navigation';

/**
 * Goes back to wherever the user actually came from (e.g. a logged-in user's
 * dashboard) instead of a hardcoded route that would kick them out to the
 * marketing landing page. Falls back to the dashboard if there's no history
 * to go back to (e.g. this page was opened directly in a new tab).
 */
export function BackButton({ fallbackHref = '/dashboard' }: { fallbackHref?: string }) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
      className="flex items-center gap-1 text-sm text-slate-500 hover:text-ink"
    >
      ← Back
    </button>
  );
}
