'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authFetch, getAuthToken } from '@/lib/session-client';

type WishlistContextValue = {
  ids: Set<number>;
  isSaved: (listingId: number) => boolean;
  toggle: (listingId: number) => Promise<void>;
  loggedIn: boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

/**
 * Server-backed, unlike CartContext's localStorage — a wishlist is a
 * per-account thing, meant to follow her across devices, not just this
 * browser (2026-09-06, marketplace-completeness scan). Fetches the full
 * set of saved listing ids exactly once per session, so a page with many
 * ListingCards doesn't fire one check-request per card.
 */
export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const token = getAuthToken();
    setLoggedIn(Boolean(token));
    if (!token) return;
    authFetch('/api/account/wishlist')
      .then((res) => (res.ok ? res.json() : { listingIds: [] }))
      .then((data: { listingIds: number[] }) => setIds(new Set(data.listingIds ?? [])));
  }, []);

  const isSaved = useCallback((listingId: number) => ids.has(listingId), [ids]);

  const toggle = useCallback(
    async (listingId: number) => {
      if (!getAuthToken()) return;
      const currentlySaved = ids.has(listingId);
      // Optimistic — a heart should feel instant; a failure just quietly
      // reverts on the next real fetch rather than blocking the tap.
      setIds((prev) => {
        const next = new Set(prev);
        if (currentlySaved) next.delete(listingId);
        else next.add(listingId);
        return next;
      });
      if (currentlySaved) {
        await authFetch(`/api/account/wishlist/${listingId}`, { method: 'DELETE' }).catch(() => {});
      } else {
        await authFetch('/api/account/wishlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listingId }),
        }).catch(() => {});
      }
    },
    [ids],
  );

  return (
    <WishlistContext.Provider value={{ ids, isSaved, toggle, loggedIn }}>{children}</WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within a WishlistProvider');
  return ctx;
}
