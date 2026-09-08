'use client';

import { createContext, useContext } from 'react';
import type { SellerReadiness } from '@/lib/seller-readiness';

export type SellerMe = {
  user: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string;
    itsId?: string | null;
    itsVerified: boolean;
    // Item 37 (2026-09-08) added this photo; item 38 (2026-09-09) made it
    // required before she can publish (see /api/sellers/its-card's own
    // comment for why it still never touches itsVerified itself — that
    // stays Admin's call, based on the number).
    itsCardImageUrl?: string | null;
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
    // Item 37 (2026-09-08) added this; item 38 (2026-09-09) made it
    // required — see /api/sellers/tax-compliance's own comment.
    taxIdDocumentUrl: string | null;
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
  // Item 38 (2026-09-09) — her seller-level mandatory-publish checklist
  // (see lib/seller-readiness.ts), fetched once here and reused by the
  // portal-wide banner (components/seller/verification-banner.tsx) so
  // every page shows the same, live answer instead of each page guessing
  // from partial fields on `me`. null while loading.
  readiness: SellerReadiness | null;
} | null>(null);

export function useSellerPortal() {
  const ctx = useContext(SellerPortalContext);
  if (!ctx) {
    throw new Error('useSellerPortal must be used within the seller portal layout');
  }
  return ctx;
}
