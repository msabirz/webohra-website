import Link from 'next/link';
import { Package, FileText } from 'lucide-react';
import { categoryColor } from '@/lib/category-color';
import { AddToCartButton } from '@/components/add-to-cart-button';
import { WhatsAppBuyButton } from '@/components/whatsapp-buy-button';
import { ConsultationRequestButton } from '@/components/consultation-request-button';

export type ListingCardData = {
  id: number;
  slug: string;
  title: string;
  price: string;
  listingType: 'physical_product' | 'local_service' | 'remote_service';
  categoryName: string;
  categorySlug: string;
  subcategoryName: string;
  businessName: string | null;
  coverImageUrl?: string | null;
};

export function ListingCard({ listing }: { listing: ListingCardData }) {
  const isService = listing.listingType !== 'physical_product';

  return (
    <Link
      href={`/collection/${listing.slug}`}
      className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/10 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:ring-ink-soft/5"
    >
      {/* Portrait, photo-dominant crop — the image is the actual product,
       *  it should carry most of the card's visual weight, with the text
       *  block beneath kept compact rather than competing for attention. */}
      <div
        className="aspect-[4/5] overflow-hidden transition-transform duration-300 group-hover:scale-[1.03]"
        style={!listing.coverImageUrl ? { backgroundColor: `${categoryColor(listing.categorySlug)}2e` } : undefined}
      >
        {listing.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time
          <img src={listing.coverImageUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center" aria-hidden>
            {isService ? (
              <FileText className="h-14 w-14 text-ink/25" strokeWidth={1.5} />
            ) : (
              <Package className="h-14 w-14 text-ink/25" strokeWidth={1.5} />
            )}
          </div>
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
          {isService ? 'Starting at ' : ''}
          ₹{Number(listing.price).toLocaleString('en-IN')}
        </p>
        <div className="mt-auto flex flex-row gap-2 pt-2.5">
          {isService ? (
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
