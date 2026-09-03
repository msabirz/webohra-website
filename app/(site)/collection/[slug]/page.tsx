'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Minus, Plus, Check, Eye } from 'lucide-react';
import { ProductGallery } from '@/components/product-gallery';
import { ServiceDetailView } from '@/components/service-detail-view';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { PickupRequestModal } from '@/components/pickup-request-modal';
import { ProductVariantPicker } from '@/components/product-variant-picker';
import { PickupExclusiveCallout } from '@/components/pickup-exclusive-callout';
import { useCart } from '@/components/cart-context';
import { getStoredLocation } from '@/lib/location-client';
import { buttonStyles } from '@/lib/button-styles';
import { ListingDetailSkeleton } from '@/components/skeleton';
import { authFetch } from '@/lib/session-client';
import { ListingDetailFields, type ListingFieldValue } from '@/components/listing-detail-fields';
import type { Variant } from '@/components/variant-menu';
import type { PortfolioItem } from '@/components/service-detail-view';

type ListingDetail = {
  id: number;
  title: string;
  description: string;
  // null = this listing uses different types (see listings.price's own
  // comment in db/schema.ts) — buyers pick one from `variants` below via
  // ProductVariantPicker instead of the single price/buy-box.
  price: string | null;
  shippingMethod: 'self_managed' | 'delhivery';
  shippingEstimateText: string | null;
  status: string;
  categoryName: string;
  categorySlug: string;
  subcategoryName: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  businessName: string | null;
  jamaatCity: string | null;
  images: { id: number; url: string }[];
  fields: ListingFieldValue[];
  variants: Variant[];
  // Fulfillment & Subscriptions redesign, Phase 3 — per-listing Pickup &
  // Pay (planning doc Decision 5). pickupCity is null when
  // pickupEnabled is false OR the seller's pickup location can't be
  // resolved yet (see lib/pickup.ts); pickupAddress is only ever present
  // when she's opted this listing into showing it up front.
  pickupEnabled: boolean;
  pickupCity: string | null;
  pickupAddress: { line1: string; line2: string | null; city: string; state: string; pincode: string } | null;
  pickupLeadTimeHours: number | null;
  // Fulfillment & Subscriptions redesign, Phase 6 — only ever populated for
  // a service listing (see ServiceDetailView, the only consumer).
  portfolio: PortfolioItem[];
  // Service contact-tiering (2026-09-03) — how a buyer reaches THIS
  // seller, resolved server-side from her active service plan; null for a
  // physical_product (contactMode never means anything there). sellerPhone
  // /sellerEmail are only ever non-null when contactMode is
  // 'whatsapp_number' (Basic) — see GET /api/listings/[idOrSlug]'s own
  // comment for why everyone else gets null here.
  contactMode: 'whatsapp_number' | 'direct_whatsapp' | 'masked_relay' | null;
  sellerPhone: string | null;
  sellerEmail: string | null;
};

export default function ListingDetailPage() {
  const params = useParams<{ slug: string }>();
  const { addItem, openCart } = useCart();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [buyerCity, setBuyerCity] = useState<string | undefined>(undefined);

  useEffect(() => {
    // authFetch, not plain fetch: a signed-in seller previewing her own
    // draft needs her session attached so the API's owner bypass (see
    // GET /api/listings/[idOrSlug]) can recognize her — a buyer with no
    // token gets exactly the same request as before, so nothing changes
    // for the normal public case.
    authFetch(`/api/listings/${params.slug}`)
      .then(async (res) => {
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        setListing(data.listing);
      })
      .finally(() => setLoading(false));
  }, [params.slug]);

  useEffect(() => {
    // Re-checks Pickup & Pay eligibility whenever the header's location
    // picker changes location, without needing a page reload — see the
    // same pattern in app/(site)/page.tsx.
    function syncLocation() {
      setBuyerCity(getStoredLocation()?.city);
    }
    syncLocation();
    window.addEventListener('wb:location-changed', syncLocation);
    return () => window.removeEventListener('wb:location-changed', syncLocation);
  }, []);

  if (loading) return <ListingDetailSkeleton />;
  if (notFound || !listing) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="font-heading text-xl font-semibold text-ink">Collection not found</p>
        <Link href="/" className="font-body text-sm text-navy underline">
          Back to home
        </Link>
      </div>
    );
  }

  const isService = listing.listingType !== 'physical_product';
  const isPreview = listing.status !== 'active';
  const hasVariants = listing.price === null;

  if (isService) {
    return (
      <div className="flex flex-col gap-6">
        {isPreview && <PreviewBanner status={listing.status} />}
        <Breadcrumb listing={listing} />
        <ServiceDetailView listing={listing} />
      </div>
    );
  }

  // Fulfillment & Subscriptions redesign, Phase 3 — per-listing (not
  // seller-wide) eligibility: she has to have turned this on for this
  // specific listing, and her resolved pickup location's city has to
  // match the buyer's. The row itself only renders at all when
  // pickupEnabled is true (see PickupRow below) — shipping method
  // (self_managed vs Delhivery) is deliberately no longer shown here,
  // just at checkout (2026-09-03 PDP redesign, user's own call: "that
  // will be informed [at] checkout page").
  const pickupEligible =
    listing.pickupEnabled &&
    !!listing.pickupCity &&
    !!buyerCity &&
    listing.pickupCity.toLowerCase() === buyerCity.toLowerCase();

  function handleAddToCart() {
    addItem(listing!.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {isPreview && <PreviewBanner status={listing.status} />}
      <Breadcrumb listing={listing} />

      <div className="grid gap-10 md:grid-cols-2 md:items-start">
        {/* Sticky on desktop — stays in view while the info column (now
         *  longer: description + details sit above the price/buy box)
         *  scrolls past it. Static on mobile, where the two columns stack.
         *  top-[140px] clears the site's own sticky two-row header
         *  (measured ~125px) plus a little breathing room. */}
        <div className="md:sticky md:top-[140px]">
          <ProductGallery categorySlug={listing.categorySlug} isService={false} images={listing.images} />
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 inline-flex w-fit items-center rounded-full bg-teal/10 px-2.5 py-1 font-body text-[11px] font-bold uppercase tracking-wide text-teal-deep">
              {listing.subcategoryName}
            </p>
            <h1 className="font-heading text-2xl font-semibold text-ink md:text-3xl">{listing.title}</h1>
            {listing.businessName && (
              <p className="mt-1.5 font-body text-sm text-ink-soft">by {listing.businessName}</p>
            )}
          </div>

          <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-ink-soft">
            {listing.description}
          </p>

          {listing.fields.length > 0 && (
            <div className="rounded-2xl bg-ivory-deep/60 p-4">
              <p className="mb-3 font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
                Details
              </p>
              <ListingDetailFields fields={listing.fields} />
            </div>
          )}

          {hasVariants ? (
            <ProductVariantPicker
              listingId={listing.id}
              variants={listing.variants}
              pickup={
                listing.pickupEnabled
                  ? {
                      pickupCity: listing.pickupCity,
                      buyerCity,
                      eligible: pickupEligible,
                      onOrderNow: () => setPickupModalOpen(true),
                    }
                  : undefined
              }
            />
          ) : (
            <>
              <p className="font-heading text-3xl font-semibold text-navy">
                ₹{Number(listing.price).toLocaleString('en-IN')}
              </p>

              {listing.pickupEnabled && (
                <PickupExclusiveCallout
                  pickupCity={listing.pickupCity}
                  buyerCity={buyerCity}
                  eligible={pickupEligible}
                  onOrderNow={() => setPickupModalOpen(true)}
                />
              )}

              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 rounded-full border border-ink-soft/20 p-1">
                    <button
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
                      aria-label="Decrease quantity"
                    >
                      <Minus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                    <span className="w-6 text-center font-body text-sm font-medium">{quantity}</span>
                    <button
                      onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
                      aria-label="Increase quantity"
                    >
                      <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    </button>
                  </div>
                  <button onClick={handleAddToCart} className={buttonStyles('accent', 'lg', 'flex-1')}>
                    {added ? (
                      <>
                        <Check className="h-4 w-4" strokeWidth={2.5} />
                        Added
                      </>
                    ) : (
                      'Add to Cart'
                    )}
                  </button>
                </div>
                {added && (
                  <button onClick={openCart} className="font-body text-xs text-navy underline">
                    View cart
                  </button>
                )}
              </div>
              <WhatsAppBuyButton listingId={listing.id} size="lg" label="Buy on WhatsApp" />
            </>
          )}
        </div>
      </div>

      {pickupModalOpen && (
        <PickupRequestModal
          listingId={listing.id}
          pickupCity={listing.pickupCity}
          pickupAddress={listing.pickupAddress}
          pickupLeadTimeHours={listing.pickupLeadTimeHours}
          onClose={() => setPickupModalOpen(false)}
        />
      )}
    </div>
  );
}

/** Shown only to the owning seller — GET /api/listings/[idOrSlug] already
 *  404s a non-active listing for anyone else, so reaching this at all means
 *  she's looking at her own unpublished page. Purely informational: the
 *  buyer actions below still work as normal (same tradeoff the rest of this
 *  app makes — e.g. guest checkout with no payment gateway — rather than
 *  threading a "preview, don't actually let her act" flag through Add to
 *  Cart, WhatsApp, and Pickup & Pay across both product and service views). */
function PreviewBanner({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-gold/10 px-4 py-3 ring-1 ring-gold/25">
      <Eye className="h-4 w-4 shrink-0 text-gold-soft" strokeWidth={2} />
      <p className="font-body text-xs text-ink-soft">
        <span className="font-semibold text-ink">Preview only</span> — this listing is{' '}
        {status === 'draft' ? 'still a draft' : status} and buyers can&apos;t see it yet. This is
        exactly how it&apos;ll look once you publish.
      </p>
    </div>
  );
}

function Breadcrumb({
  listing,
}: {
  listing: { categorySlug: string; categoryName: string; subcategoryName: string };
}) {
  return (
    <nav className="flex items-center gap-1.5 font-body text-xs text-ink-soft">
      <Link href={`/c/${listing.categorySlug}`} className="hover:text-ink hover:underline">
        {listing.categoryName}
      </Link>
      <ChevronRight className="h-3 w-3" strokeWidth={2} />
      <span>{listing.subcategoryName}</span>
    </nav>
  );
}

