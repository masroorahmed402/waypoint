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
