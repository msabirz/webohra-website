'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, MapPin, Store } from 'lucide-react';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton, Skeleton } from '@/components/skeleton';
import { StarRating } from '@/components/star-rating';

type SellerProfile = {
  businessName: string;
  itsVerified: boolean;
  city: string | null;
  rating: { average: number; count: number } | null;
};

/**
 * Seller storefront (Tier 4, item 24, 2026-09-07) — "everything this
 * seller sells" in one place, genuinely absent before this (a buyer
 * could only ever browse one listing at a time). The part of "seller
 * onboarding beyond ITS" that isn't blocked on the still-open SSO
 * question — see GET /api/sellers/storefront/[slug]'s own comment.
 */
export default function SellerStorefrontPage() {
  const params = useParams<{ slug: string }>();
  const [seller, setSeller] = useState<SellerProfile | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [listings, setListings] = useState<ListingCardData[] | null>(null);

  useEffect(() => {
    fetch(`/api/sellers/storefront/${params.slug}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setSeller(data.seller);
      });
    fetch(`/api/listings?sellerSlug=${params.slug}&sort=newest&limit=60`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []));
  }, [params.slug]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-heading text-xl font-semibold text-ink">Seller not found</p>
        <Link href="/" className="font-body text-sm text-navy underline">
          Back to home
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-gradient-to-b from-navy/5 to-transparent px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-navy/10">
          <Store className="h-7 w-7 text-navy" strokeWidth={1.75} />
        </span>
        {seller ? (
          <>
            <h1 className="font-heading text-2xl font-semibold text-ink md:text-3xl">{seller.businessName}</h1>
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
              {seller.itsVerified && (
                <span className="flex items-center gap-1 font-body text-xs font-semibold text-teal-deep">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  Bohra women-owned, ITS verified
                </span>
              )}
              {seller.city && (
                <span className="flex items-center gap-1 font-body text-xs text-ink-soft">
                  <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
                  {seller.city}
                </span>
              )}
              {seller.rating && (
                <span className="flex items-center gap-1.5">
                  <StarRating rating={seller.rating.average} className="text-gold" />
                  <span className="font-body text-xs text-ink-soft">
                    {seller.rating.average.toFixed(1)} ({seller.rating.count})
                  </span>
                </span>
              )}
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32" />
          </>
        )}
      </div>

      {listings === null ? (
        <ListingGridSkeleton count={8} />
      ) : listings.length === 0 ? (
        <p className="rounded-2xl bg-white p-8 text-center font-body text-sm text-ink-soft shadow-sm ring-1 ring-ink-soft/5">
          Nothing listed yet.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}
    </div>
  );
}
