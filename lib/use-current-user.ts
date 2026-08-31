'use client';

import { useEffect, useState } from 'react';
import { authFetch, getAuthToken } from '@/lib/session-client';

export type CurrentUser = {
  id: number;
  phone: string;
  phoneVerified: boolean;
  name: string | null;
  email: string | null;
  hasPassword: boolean;
  itsVerified: boolean;
  staffRole: string | null;
};

export type CurrentSellerProfile = { businessName: string } | null;

/** Whoever's signed in right now, buyer or seller — same session, same
 *  /api/auth/me. Re-checks whenever a login/logout happens anywhere on
 *  the page (see session-client's 'wb:auth-changed' event). `sellerProfile`
 *  is non-null only if she's also registered as a seller. */
export function useCurrentUser() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [sellerProfile, setSellerProfile] = useState<CurrentSellerProfile>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    function load() {
      if (!getAuthToken()) {
        setUser(null);
        setSellerProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      authFetch('/api/auth/me')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          setUser(data?.user ?? null);
          setSellerProfile(data?.sellerProfile ?? null);
        })
        .finally(() => setLoading(false));
    }

    load();
    window.addEventListener('wb:auth-changed', load);
    return () => window.removeEventListener('wb:auth-changed', load);
  }, []);

  return { user, sellerProfile, loading };
}
