'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronRight, Truck, Handshake, Minus, Plus, Check, Eye } from 'lucide-react';
import { ProductGallery } from '@/components/product-gallery';
import { ServiceDetailView } from '@/components/service-detail-view';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { PickupRequestModal } from '@/components/pickup-request-modal';
import { useCart } from '@/components/cart-context';
import { getStoredLocation } from '@/lib/location-client';
import { buttonStyles } from '@/lib/button-styles';
import { ListingDetailSkeleton } from '@/components/skeleton';
import { authFetch } from '@/lib/session-client';

type ListingDetail = {
  id: number;
  title: string;
  description: string;
  price: string;
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
};

type FulfillmentChoice = 'delivery' | 'pickup';

export default function ListingDetailPage() {
  const params = useParams<{ slug: string }>();
  const { addItem, openCart } = useCart();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [choice, setChoice] = useState<FulfillmentChoice>('delivery');
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

  if (isService) {
    return (
      <div className="flex flex-col gap-6">
        {isPreview && <PreviewBanner status={listing.status} />}
        <Breadcrumb listing={listing} />
        <ServiceDetailView listing={listing} />
      </div>
    );
  }

  const pickupEligible =
    !!listing.jamaatCity && !!buyerCity && listing.jamaatCity.toLowerCase() === buyerCity.toLowerCase();

  function handleAddToCart() {
    addItem(listing!.id, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {isPreview && <PreviewBanner status={listing.status} />}
      <Breadcrumb listing={listing} />

      <div className="grid gap-10 md:grid-cols-2">
        <ProductGallery categorySlug={listing.categorySlug} isService={false} images={listing.images} />

        <div className="flex flex-col gap-5">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-ink md:text-3xl">
              {listing.title}
            </h1>
            {listing.businessName && (
              <p className="mt-1.5 font-body text-sm text-ink-soft">by {listing.businessName}</p>
            )}
          </div>

          <p className="font-heading text-3xl font-semibold text-navy">
            ₹{Number(listing.price).toLocaleString('en-IN')}
          </p>

          <p className="whitespace-pre-wrap font-body text-sm leading-relaxed text-ink-soft">
            {listing.description}
          </p>

          {/* Fulfillment selector — radio rows, single CTA below, no tabs */}
          <div className="flex flex-col gap-2.5">
            <FulfillmentRow
              icon={Truck}
              selected={choice === 'delivery'}
              onSelect={() => setChoice('delivery')}
              title="Delivery"
              price="See details"
              subtitle={
                listing.shippingMethod === 'delhivery'
                  ? 'Shipped via Delhivery — real, live tracking.'
                  : listing.shippingEstimateText || 'Shipped by the seller directly.'
              }
            />
            <FulfillmentRow
              icon={Handshake}
              selected={choice === 'pickup'}
              onSelect={() => pickupEligible && setChoice('pickup')}
              disabled={!pickupEligible}
              title="Pickup & Pay"
              price="No shipping"
              subtitle={pickupSubtitle(listing.jamaatCity, buyerCity, pickupEligible)}
            />
          </div>

          {choice === 'delivery' ? (
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
          ) : (
            <button
              onClick={() => setPickupModalOpen(true)}
              className={buttonStyles('accent', 'lg', 'w-full')}
            >
              Request Pickup &amp; Pay
            </button>
          )}

          <WhatsAppBuyButton listingId={listing.id} size="lg" label="Buy on WhatsApp" />
        </div>
      </div>

      {pickupModalOpen && (
        <PickupRequestModal listingId={listing.id} onClose={() => setPickupModalOpen(false)} />
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

/** Always names the pickup city, whether or not she's currently eligible —
 *  per the requester's ask that this be stated plainly, not just "not
 *  available". */
function pickupSubtitle(
  jamaatCity: string | null,
  buyerCity: string | undefined,
  eligible: boolean,
): string {
  if (!jamaatCity) return 'This seller has no pickup point set up yet.';
  if (eligible) return `Available in ${jamaatCity} — collect from the seller and pay her directly.`;
  if (buyerCity) return `Only available in ${jamaatCity} — not ${buyerCity}.`;
  return `Available in ${jamaatCity} — set your location to check eligibility.`;
}

function FulfillmentRow({
  icon: Icon,
  selected,
  onSelect,
  disabled,
  title,
  price,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  title: string;
  price: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition-all ${
        disabled
          ? 'border-ink-soft/10 bg-ivory-deep/40 opacity-60'
          : selected
            ? 'border-navy bg-white shadow-sm ring-1 ring-navy/10'
            : 'border-ink-soft/15 bg-ivory-deep hover:border-navy/30 hover:bg-white'
      }`}
    >
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          selected && !disabled ? 'bg-navy text-ivory' : 'bg-white text-ink-soft ring-1 ring-ink-soft/15'
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="flex-1">
        <span className="flex items-center justify-between">
          <span className="font-body text-sm font-semibold text-ink">{title}</span>
          <span className="font-body text-xs font-medium text-ink-soft">{price}</span>
        </span>
        <span className="mt-0.5 block font-body text-xs text-ink-soft">{subtitle}</span>
      </span>
    </button>
  );
}
