'use client';
import { api } from './api';

export function joinWaitlist(email: string) {
  return api<{ ok: boolean }>('/waitlist', {
    method: 'POST',
    body: JSON.stringify({ email, source: 'landing' }),
  });
}
