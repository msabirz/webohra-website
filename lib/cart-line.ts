import type { CartItem } from '@/components/cart-context';

/** The shape both the cart drawer and checkout page fetch per unique
 *  listingId in the cart (from GET /api/listings/[id]) — just enough to
 *  price and label each line. */
export type CartListingSnapshot = {
  id: number;
  title: string;
  // null for a variant-based listing — resolveCartLine looks at `variants`
  // instead in that case.
  price: string | null;
  businessName: string | null;
  variants: { id: number; name: string; price: string }[];
};

/**
 * A cart line's actual price and display name — either the listing's own
 * (a simple, single-price listing), or whichever of its variants this
 * specific line is for. A null price means the referenced variant no
 * longer exists (the seller deleted it after it was added to cart) —
 * treated as unpriceable, never silently substituted with 0.
 */
export function resolveCartLine(
  listing: CartListingSnapshot | undefined,
  item: CartItem,
): { price: number | null; variantName: string | null } {
  if (!listing) return { price: null, variantName: null };
  if (item.variantId === null) return { price: listing.price !== null ? Number(listing.price) : null, variantName: null };
  const variant = listing.variants.find((v) => v.id === item.variantId);
  return { price: variant ? Number(variant.price) : null, variantName: variant?.name ?? null };
}
