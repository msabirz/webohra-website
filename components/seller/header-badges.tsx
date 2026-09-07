'use client';

import Link from 'next/link';
import { ShieldCheck, ShieldAlert, Wallet } from 'lucide-react';
import { useSellerPortal } from '@/lib/seller-context';

/**
 * Verification badge + wallet balance chip — item 30 (2026-09-07),
 * pulled out of the sidebar-only placement so both are visible in the
 * portal header itself (mobile top bar and the new desktop header bar),
 * not just tucked under her business name where she'd only see it by
 * having the sidebar open. Reads live state from SellerPortalContext —
 * NotificationBell already does the same, this just adds the other two
 * pieces of "how's my store doing right now" the user asked for.
 *
 * `dark`: the mobile top bar and desktop sidebar sit on the navy
 * background (light text on dark); the new desktop header bar sits on
 * white (dark text on light) — same two badges, different token set.
 */
export function SellerHeaderBadges({ dark = false }: { dark?: boolean }) {
  const { me, walletBalance } = useSellerPortal();

  return (
    <div className="flex items-center gap-2">
      {me.user.itsVerified ? (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-xs font-medium ${
            dark ? 'bg-teal/20 text-teal-deep' : 'bg-teal/10 text-teal-deep'
          }`}
        >
          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">ITS verified</span>
        </span>
      ) : (
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-body text-xs font-medium ${
            dark ? 'bg-gold/20 text-gold-soft' : 'bg-gold/15 text-gold'
          }`}
        >
          <ShieldAlert className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="hidden sm:inline">Verification pending</span>
        </span>
      )}

      <Link
        href="/seller/wallet"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-body text-xs font-semibold transition ${
          dark ? 'bg-white/10 text-ivory hover:bg-white/15' : 'bg-navy/5 text-navy hover:bg-navy/10'
        }`}
      >
        <Wallet className="h-3.5 w-3.5" strokeWidth={2} />
        {walletBalance === null ? (
          <span className="opacity-70">…</span>
        ) : (
          <span className={Number(walletBalance) < 0 ? 'text-red-500' : ''}>
            ₹{Number(walletBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </span>
        )}
      </Link>
    </div>
  );
}
