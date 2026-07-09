'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null; // in memory only — never localStorage (ADR-003)
export const setAccessToken = (t: string | null) => { accessToken = t; };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/**
 * Returns true if refreshed, false if the session is genuinely gone (refresh
 * token missing/expired/revoked — a clean 401/403). Throws for anything else
 * (network error, 5xx from a Railway cold start or DB hiccup) so the caller
 * doesn't mistake "the API is briefly down" for "you're logged out".
 */
async function refresh(): Promise<boolean> {
  const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (res.status === 401 || res.status === 403) return false;
  if (!res.ok) throw new Error(`Session refresh failed with status ${res.status}`);
  const body = await res.json();
  accessToken = body.accessToken;
  return true;
}

export async function api<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });

  if (res.status === 401 && !retried && !path.startsWith('/auth/')) {
    try {
      if (await refresh()) return api<T>(path, init, true);
      // refresh() cleanly reported no valid session — genuinely logged out.
      if (typeof window !== 'undefined') window.location.href = '/login';
    } catch {
      // Network/server error while refreshing — the user may still have a valid
      // session, so don't log them out. Let the original 401 fall through below
      // and surface as a normal ApiError the UI can show and let them retry.
    }
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message.join('; ') : body.message ?? res.statusText;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

/** For non-JSON downloads (e.g. .ics export) — same auth as api(), returns a raw Blob. */
export async function apiBlob(path: string, retried = false): Promise<Blob> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
  });
  if (res.status === 401 && !retried) {
    if (await refresh()) return apiBlob(path, true);
  }
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return res.blob();
}
