'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { CartProvider } from '@/components/cart-context';
import { CartDrawer } from '@/components/cart-drawer';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { buttonStyles } from '@/lib/button-styles';

/**
 * Site-wide 404 (2026-09-04, user's own ask) — instead of a dead end,
 * shows a handful of real listings so a broken/mistyped link still turns
 * into a browsing session. "Random" here just means: fetch a larger
 * newest-first batch, then shuffle client-side and keep a handful — no
 * real popularity/sales-count metric exists yet to rank by, so this is
 * an honest "random pick," not a fake "top products" claim.
 *
 * Lives at the app ROOT, not inside app/(site)/ — a route group's own
 * not-found.tsx only ever fires for an explicit notFound() call from a
 * page already inside that group's matched tree; a genuinely unmatched
 * top-level path (any typo, any dead link) falls through to this one
 * instead, which is why it manually renders the same
 * header/footer/cart chrome app/(site)/layout.tsx does rather than
 * inheriting it. Scoped to the public buyer-facing look on purpose — a
 * mistyped /admin or /seller URL is rare enough (staff, not buyers) not
 * to warrant its own portal-styled 404 too.
 */
export default function NotFound() {
  const [listings, setListings] = useState<ListingCardData[] | null>(null);

  useEffect(() => {
    fetch('/api/listings?sort=newest&limit=24')
      .then((res) => res.json())
      .then((data) => {
        const all: ListingCardData[] = data.listings ?? [];
        const shuffled = [...all].sort(() => Math.random() - 0.5);
        setListings(shuffled.slice(0, 6));
      })
      .catch(() => setListings([]));
  }, []);

  return (
    <CartProvider>
      <div className="flex min-h-screen flex-col bg-ivory">
        <SiteHeader />
        <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 py-6">
          <div className="flex flex-col items-center gap-10 py-10 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy/10">
                <Compass className="h-6 w-6 text-navy" strokeWidth={1.75} />
              </span>
              <h1 className="font-heading text-3xl font-semibold text-ink">Page not found</h1>
              <p className="max-w-sm font-body text-sm text-ink-soft">
                That link&apos;s gone missing — but here&apos;s a few things worth a look while
                you&apos;re here.
              </p>
              <Link href="/collections" className={buttonStyles('primary', 'md', 'mt-2')}>
                Browse Collections
              </Link>
            </div>

            <div className="w-full max-w-5xl text-left">
              {listings === null ? (
                <ListingGridSkeleton />
              ) : listings.length > 0 ? (
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {listings.map((listing) => (
                    <ListingCard key={listing.id} listing={listing} />
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
      <CartDrawer />
    </CartProvider>
  );
}
