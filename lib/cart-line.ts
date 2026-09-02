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
  sellerId?: number;
  variants: { id: number; name: string; price: string }[];
  // Fulfillment & Subscriptions redesign, Phase 3 — used to compute the
  // real shipping line at checkout. Optional so callers that never needed
  // shipping before (e.g. the cart drawer's line-item display) don't have
  // to supply it.
  shippingMethod?: 'self_managed' | 'delhivery';
  selfShipCharge?: string | null;
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

/**
 * One shipment per (seller, method) — never per (seller) alone, so a buyer
 * with a self-managed item and a Delhivery item from the same seller gets
 * two separate charges instead of one invented blended number (planning
 * doc's Risk 1, resolved the same way Amazon bills FBA/FBM items from one
 * seller separately). The charge itself applies once per shipment, not
 * once per item in it — the highest selfShipCharge set among that
 * shipment's listings, since items usually ship together in one box; an
 * item with no charge set contributes 0, not a validation error, so
 * checkout never blocks on a seller who simply hasn't set one yet.
 * Delhivery shipments are always free today — no live rate lookup exists
 * yet (planning doc Decision 4/7), same "no cost shown" experience
 * Delhivery listings have always had, preserved exactly rather than
 * inventing a number.
 *
 * Mirrored server-side in POST /api/orders — keep the two in sync if this
 * logic ever changes; the server never trusts this client-side number, it
 * only shows it to her before she commits.
 */
export function computeShipmentGroups(
  items: CartItem[],
  listings: Record<number, CartListingSnapshot>,
): Array<{ sellerId: number; businessName: string | null; method: 'self_managed' | 'delhivery'; charge: number }> {
  const groups = new Map<
    string,
    { sellerId: number; businessName: string | null; method: 'self_managed' | 'delhivery'; charge: number }
  >();
  for (const item of items) {
    const listing = listings[item.listingId];
    if (!listing || listing.sellerId === undefined || !listing.shippingMethod) continue;
    const key = `${listing.sellerId}:${listing.shippingMethod}`;
    const itemCharge = listing.shippingMethod === 'self_managed' ? Number(listing.selfShipCharge ?? 0) : 0;
    const existing = groups.get(key);
    if (existing) {
      existing.charge = Math.max(existing.charge, itemCharge);
    } else {
      groups.set(key, {
        sellerId: listing.sellerId,
        businessName: listing.businessName,
        method: listing.shippingMethod,
        charge: itemCharge,
      });
    }
  }
  return Array.from(groups.values());
}
