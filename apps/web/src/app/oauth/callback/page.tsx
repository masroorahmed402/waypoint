'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function OAuthCallback() {
  const router = useRouter();
  const { refreshMe } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    (async () => {
      if (token) {
        setAccessToken(token);
        await refreshMe();
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    })();
  }, [router, refreshMe]);

  return <main className="flex min-h-screen items-center justify-center text-slate-500">Signing you in…</main>;
}
