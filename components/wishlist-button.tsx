'use client';

import { Heart } from 'lucide-react';
import Link from 'next/link';
import { useWishlist } from '@/components/wishlist-context';

/**
 * Overlay-style heart, meant to sit on a ListingCard's image or a PDP
 * header — stops the click from also firing whatever Link wraps it (same
 * pattern as the card's own photo-cycle dots). A logged-out tap goes
 * straight to login instead of silently doing nothing, since there's no
 * account to save against yet.
 */
export function WishlistButton({ listingId, className }: { listingId: number; className?: string }) {
  const { isSaved, toggle, loggedIn } = useWishlist();
  const saved = isSaved(listingId);

  const base = className ?? 'flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition';
  // Saved-state color always applies on top of whatever base/custom
  // className a caller passes — losing this would mean a customized
  // button (e.g. the PDP's) never actually showed a heart as saved.
  const colorClass = saved ? 'text-red-600' : 'text-ink-soft hover:text-ink';

  if (!loggedIn) {
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(typeof window !== 'undefined' ? window.location.pathname : '/')}`}
        onClick={(e) => e.stopPropagation()}
        title="Log in to save"
        aria-label="Log in to save this listing"
        className={`${base} text-ink-soft hover:text-ink`}
      >
        <Heart className="h-4 w-4" strokeWidth={2} />
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(listingId);
      }}
      aria-label={saved ? 'Remove from saved' : 'Save this listing'}
      aria-pressed={saved}
      title={saved ? 'Remove from saved' : 'Save'}
      className={`${base} ${colorClass}`}
    >
      <Heart className="h-4 w-4" strokeWidth={2} fill={saved ? 'currentColor' : 'none'} />
    </button>
  );
}
