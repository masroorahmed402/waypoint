'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAccessToken } from './api';
import { identify } from './posthog';

export interface Me {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  profile: null | {
    id: string;
    degreeLevel: string;
    major: string;
    visaType: string;
    programStartDate: string;
    programEndDate: string;
    usEntryDate: string | null;
    university: { id: string; name: string; slug: string } | null;
    universityName: string | null;
  };
}

interface AuthCtx {
  me: Me | null;
  loading: boolean;
  refreshMe: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({ me: null, loading: true, refreshMe: async () => {}, logout: async () => {} });
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    try {
      const data = await api<Me>('/users/me');
      setMe(data);
      identify(data.id, { hasProfile: !!data.profile });
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    // Bootstrap: try refreshing the session (httpOnly cookie), then load profile.
    (async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/refresh`, {
          method: 'POST', credentials: 'include',
        });
        if (r.ok) {
          const body = await r.json();
          setAccessToken(body.accessToken);
          await refreshMe();
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setMe(null);
    window.location.href = '/login';
  }, []);

  return <Ctx.Provider value={{ me, loading, refreshMe, logout }}>{children}</Ctx.Provider>;
}
