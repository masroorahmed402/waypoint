export const TOAST_EVENT = 'waypoint:toast';

export function showToast(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(TOAST_EVENT, { detail: message }));
}
