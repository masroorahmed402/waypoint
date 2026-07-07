'use client';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

let accessToken: string | null = null; // in memory only — never localStorage (ADR-003)
export const setAccessToken = (t: string | null) => { accessToken = t; };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function refresh(): Promise<boolean> {
  const res = await fetch(`${API}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
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
    if (await refresh()) return api<T>(path, init, true);
    if (typeof window !== 'undefined') window.location.href = '/login';
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message.join('; ') : body.message ?? res.statusText;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}
