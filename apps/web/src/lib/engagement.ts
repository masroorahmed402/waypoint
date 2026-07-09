// Lightweight local engagement flags for profile-strength scoring — these
// track one-time product actions that have no natural server-side record.
// Every key is scoped by userId: unscoped keys leak between accounts that
// share a browser (a new user would inherit the previous user's badges and
// streak). See advisor/page.tsx for the same class of bug with conversation
// history — these are lower severity (no sensitive content) but the same fix.
const ADVISOR_USED_KEY = 'waypoint_advisor_used';
const DSO_EMAIL_DRAFTED_KEY = 'waypoint_dso_email_drafted';
const STREAK_KEY = 'waypoint_checkin_streak';
const LAST_CHECKIN_KEY = 'waypoint_last_checkin';

const scoped = (key: string, userId: string) => `${key}:${userId}`;

export function markAdvisorUsed(userId: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(scoped(ADVISOR_USED_KEY, userId), '1');
}

export function hasUsedAdvisor(userId: string): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(scoped(ADVISOR_USED_KEY, userId)) === '1';
}

export function markDsoEmailDrafted(userId: string) {
  if (typeof window !== 'undefined') window.localStorage.setItem(scoped(DSO_EMAIL_DRAFTED_KEY, userId), '1');
}

export function hasDraftedDsoEmail(userId: string): boolean {
  return typeof window !== 'undefined' && window.localStorage.getItem(scoped(DSO_EMAIL_DRAFTED_KEY, userId)) === '1';
}

export function getGreeting(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

/** Records today's visit and returns the current consecutive-day streak. */
export function recordCheckIn(userId: string): number {
  if (typeof window === 'undefined') return 0;
  const today = new Date().toDateString();
  const last = window.localStorage.getItem(scoped(LAST_CHECKIN_KEY, userId));
  if (last === today) return Number(window.localStorage.getItem(scoped(STREAK_KEY, userId)) ?? '1');

  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const prevStreak = Number(window.localStorage.getItem(scoped(STREAK_KEY, userId)) ?? '0');
  const nextStreak = last === yesterday ? prevStreak + 1 : 1;

  window.localStorage.setItem(scoped(STREAK_KEY, userId), String(nextStreak));
  window.localStorage.setItem(scoped(LAST_CHECKIN_KEY, userId), today);
  return nextStreak;
}

/** Legacy unscoped keys from before engagement flags were per-user — purge on logout. */
export const LEGACY_UNSCOPED_ENGAGEMENT_KEYS = [
  ADVISOR_USED_KEY,
  DSO_EMAIL_DRAFTED_KEY,
  STREAK_KEY,
  LAST_CHECKIN_KEY,
];
