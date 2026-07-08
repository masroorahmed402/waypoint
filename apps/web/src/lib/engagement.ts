// Lightweight local engagement flags for profile-strength scoring — these
// track one-time product actions that have no natural server-side record.
const ADVISOR_USED_KEY = 'waypoint_advisor_used';
const DSO_EMAIL_DRAFTED_KEY = 'waypoint_dso_email_drafted';

export function markAdvisorUsed() {
  if (typeof window !== 'undefined') window.localStorage.setItem(ADVISOR_USED_KEY, '1');
}

export function hasUsedAdvisor(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(ADVISOR_USED_KEY) === '1';
}

export function markDsoEmailDrafted() {
  if (typeof window !== 'undefined') window.localStorage.setItem(DSO_EMAIL_DRAFTED_KEY, '1');
}

export function hasDraftedDsoEmail(): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(DSO_EMAIL_DRAFTED_KEY) === '1';
}

export function getGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const STREAK_KEY = 'waypoint_checkin_streak';
const LAST_CHECKIN_KEY = 'waypoint_last_checkin';

/** Records today's visit and returns the current consecutive-day streak. */
export function recordCheckIn(): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toDateString();
  const last = window.localStorage.getItem(LAST_CHECKIN_KEY);
  if (last === today) return Number(window.localStorage.getItem(STREAK_KEY) ?? '1');

  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const prevStreak = Number(window.localStorage.getItem(STREAK_KEY) ?? '0');
  const nextStreak = last === yesterday ? prevStreak + 1 : 1;

  window.localStorage.setItem(STREAK_KEY, String(nextStreak));
  window.localStorage.setItem(LAST_CHECKIN_KEY, today);
  return nextStreak;
}
