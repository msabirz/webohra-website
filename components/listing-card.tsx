'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Package, FileText, ChevronRight } from 'lucide-react';
import { categoryColor } from '@/lib/category-color';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { ConsultationRequestButton } from '@/components/consultation-request-button';

export type ListingCardData = {
  id: number;
  slug: string;
  title: string;
  // null = this listing uses different types (see listings.price's own
  // comment in db/schema.ts) — `displayPrice` (the cheapest type) is what
  // the card actually shows, prefixed "From", and there's no single quick
  // action to fire from the grid since no type has been picked yet.
  price: string | null;
  displayPrice: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  categoryName: string;
  categorySlug: string;
  subcategoryName: string;
  businessName: string | null;
  coverImageUrl?: string | null;
  /** Up to a handful of the listing's own photos (see /api/listings), in
   *  the seller's own sort order — powers the tap-through dots below. Falls
   *  back to just `coverImageUrl` when a caller hasn't supplied this. */
  imageUrls?: string[];
};

const AUTO_CYCLE_MS = 2800;

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const [activeImage, setActiveImage] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isService = listing.listingType !== 'physical_product';
  const hasVariants = listing.price === null;
  const images = listing.imageUrls?.length
    ? listing.imageUrls
    : listing.coverImageUrl
      ? [listing.coverImageUrl]
      : [];
  const imageCount = images.length;

  function stopCycle() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startCycle() {
    stopCycle();
    if (imageCount < 2) return;
    intervalRef.current = setInterval(() => {
      setActiveImage((prev) => (prev + 1) % imageCount);
    }, AUTO_CYCLE_MS);
  }

  useEffect(() => {
    startCycle();
    return stopCycle;
    // Re-run only when the photo count actually changes — imageCount is
    // derived fresh each render, but its value is what matters here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageCount]);

  function jumpTo(event: React.MouseEvent, index: number) {
    // Dots sit inside the card's own full-bleed Link (see WhatsAppBuyButton/
    // ConsultationRequestButton below for the same pattern) — without this,
    // tapping a dot would also navigate to the PDP instead of just paging
    // the preview.
    event.preventDefault();
    event.stopPropagation();
    setActiveImage(index);
    // A manual pick restarts the auto-cycle from here, rather than letting
    // whatever tick was already in flight immediately override her choice.
    startCycle();
  }

  return (
    <Link
      href={`/collection/${listing.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/10 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-ink-soft/5"
    >
      {/* Portrait, photo-dominant crop — the image is the actual product,
       *  it should carry most of the card's visual weight, with the text
       *  block beneath kept compact rather than competing for attention. */}
      <div
        className="relative aspect-[4/5] overflow-hidden transition-transform duration-300 group-hover:scale-[1.03]"
        style={images.length === 0 ? { backgroundColor: `${categoryColor(listing.categorySlug)}2e` } : undefined}
        onMouseEnter={stopCycle}
        onMouseLeave={startCycle}
      >
        {images.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
          <img src={images[activeImage]} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden>
            {isService ? (
              <FileText className="h-14 w-14 text-ink/25" strokeWidth={1.5} />
            ) : (
              <Package className="h-14 w-14 text-ink/25" strokeWidth={1.5} />
            )}
          </div>
        )}

        {images.length > 1 && (
          <>
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-ink/35 to-transparent"
              aria-hidden
            />
            <div className="absolute inset-x-0 bottom-2 flex items-center justify-center gap-1">
              {images.map((_, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={(e) => jumpTo(e, index)}
                  aria-label={`Show photo ${index + 1} of ${images.length}`}
                  className={`h-1.5 rounded-full transition-all ${
                    index === activeImage ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-0.5 p-4">
        {/* Seller name reads first and bold — the "brand" line — with the
         *  product title itself as the lighter, secondary line beneath it.
         *  Only real fields: no star rating or struck-through MRP here,
         *  since this marketplace doesn't have reviews or list-price data
         *  to back either of those with. */}
        {listing.businessName && (
          <p className="truncate font-body text-sm font-bold text-ink">{listing.businessName}</p>
        )}
        <p className="truncate font-body text-sm text-ink-soft">{listing.title}</p>
        <p className="mt-1 font-heading text-lg font-semibold text-navy">
          {isService || hasVariants ? 'Starting at ' : ''}
          ₹{Number(listing.displayPrice).toLocaleString('en-IN')}
        </p>
        <div className="mt-auto flex flex-row gap-2 pt-2.5">
          {hasVariants ? (
            // No single type picked yet from the grid — the card's own Link
            // already goes to the PDP/SDP, this is just a visible affordance
            // rather than a real second click target.
            <span className="flex w-full items-center justify-center gap-1 rounded-xl bg-ivory-deep px-2 py-2 font-body text-xs font-semibold text-ink-soft">
              View options
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          ) : isService ? (
            <ConsultationRequestButton listingId={listing.id} label="Take Consultation" width="full" shape="box" />
          ) : (
            <>
              <AddToCartButton listingId={listing.id} width="share" shape="box" />
              <WhatsAppBuyButton listingId={listing.id} label="WhatsApp" width="share" shape="box" />
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
