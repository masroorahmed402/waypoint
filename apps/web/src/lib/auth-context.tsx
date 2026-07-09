'use client';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
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
    stemEligible: boolean;
    onReducedCourseLoad?: boolean;
    rclEndDate?: string | null;
    changeOfStatusDetected?: boolean;
    capGapDetected?: boolean;
    countryOfCitizenship?: string | null;
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
  const router = useRouter();
  const qc = useQueryClient();

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
    // A failure here (network hiccup, Railway cold start, transient 5xx) must
    // never be treated as "log the user out" — it just means we couldn't confirm
    // a session on this load, so we fall through to the logged-out UI silently
    // rather than throwing or forcing a redirect.
    (async () => {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/refresh`, {
          method: 'POST', credentials: 'include',
        });
        if (r.ok) {
          const body = await r.json();
          setAccessToken(body.accessToken);
          try {
            await refreshMe();
          } catch {
            // Token refresh succeeded but /users/me failed transiently — leave
            // loading to resolve normally rather than forcing a logged-out state.
          }
        }
        // Non-ok response (no cookie, expired refresh token, or a transient
        // server error) — stay logged out silently, no throw, no redirect.
      } catch {
        // Network error reaching the API during bootstrap — don't log out.
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshMe]);

  const logout = useCallback(async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    setAccessToken(null);
    setMe(null);
    // Clear all cached queries so a different user logging in on the same
    // browser session never sees the previous user's cached data.
    qc.clear();
    router.push('/login');
  }, [qc, router]);

  return <Ctx.Provider value={{ me, loading, refreshMe, logout }}>{children}</Ctx.Provider>;
}
