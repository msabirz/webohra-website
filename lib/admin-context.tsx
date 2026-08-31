'use client';

import { createContext, useContext } from 'react';

export type AdminMe = {
  id: number;
  name: string | null;
  email: string | null;
  phone: string;
  staffRole: 'customer_support' | 'admin' | 'super_admin';
};

/** Populated once by app/admin/(portal)/layout.tsx after the auth gate
 *  passes — admin pages read from here instead of re-fetching /api/auth/me
 *  on every navigation. */
export const AdminPortalContext = createContext<{ me: AdminMe } | null>(null);

export function useAdminPortal() {
  const ctx = useContext(AdminPortalContext);
  if (!ctx) {
    throw new Error('useAdminPortal must be used within the admin portal layout');
  }
  return ctx;
}
