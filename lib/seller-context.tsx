'use client';

import { createContext, useContext } from 'react';

export type SellerMe = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string;
    itsId?: string | null;
    itsVerified: boolean;
    hasPassword: boolean;
  };
  sellerProfile: {
    businessName: string;
    jamaatId: number | null;
    jamaatName: string | null;
    jamaatCity: string | null;
    // Fulfillment & Subscriptions redesign, Phase 2.
    addressLine1: string | null;
    addressLine2: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  };
  sellerShipCity: string | null;
};

/** Populated once by app/seller/(portal)/layout.tsx after the auth gate
 *  passes — portal pages read from here instead of re-fetching /api/auth/me
 *  on every navigation. `unreadEnquiries` is polled here too (once, by the
 *  layout, not by each NotificationBell instance — see its own comment for
 *  why: it renders twice, once for the mobile top bar and once for the
 *  desktop sidebar, and polling independently in each would double every
 *  request for no reason). */
export const SellerPortalContext = createContext<{
  me: SellerMe;
  refresh: () => void;
  unreadEnquiries: number;
  refreshUnread: () => void;
} | null>(null);

export function useSellerPortal() {
  const ctx = useContext(SellerPortalContext);
  if (!ctx) {
    throw new Error('useSellerPortal must be used within the seller portal layout');
  }
  return ctx;
}
