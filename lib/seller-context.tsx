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
    // Her saved, reusable Pickup & Pay address (item 26, 2026-09-07) —
    // read by the product form to know whether she already has a
    // default before deciding whether a listing needs its own override.
    pickupOtherAddressLine1: string | null;
    pickupOtherAddressLine2: string | null;
    pickupOtherAddressCity: string | null;
    pickupOtherAddressState: string | null;
    pickupOtherAddressPincode: string | null;
    // GST/KYC compliance (item 33, 2026-09-08) — see
    // /seller/tax-compliance and its own submit route for the full story.
    taxIdType: 'gst' | 'udyam' | null;
    taxIdNumber: string | null;
    taxIdSubmittedAt: string | null;
    taxIdVerified: boolean;
    taxIdRejectedReason: string | null;
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
  // Item 30 (2026-09-07) — her wallet balance, shown in the new portal
  // header. null while loading or if she has no wallet row yet (never
  // had a commission-deducting event) — a real, honest state, not an
  // error. Same "polled once, centrally" reasoning as unreadEnquiries:
  // refreshWallet is exposed so a real action elsewhere (a top-up
  // completing on /seller/wallet) can update the header immediately
  // instead of waiting for the next poll tick.
  walletBalance: string | null;
  refreshWallet: () => void;
} | null>(null);

export function useSellerPortal() {
  const ctx = useContext(SellerPortalContext);
  if (!ctx) {
    throw new Error('useSellerPortal must be used within the seller portal layout');
  }
  return ctx;
}
