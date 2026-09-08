import { NextResponse } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, subcategories } from '@/db/schema';
import { bulkListingStatusUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { checkSellerMandatoryVerification, checkListingMandatoryInfo } from '@/lib/seller-readiness';
import { checkPublishGate } from '@/lib/subscriptions';

/**
 * PATCH /api/listings/bulk-status
 *
 * Multi-select "Publish selected" / "Archive selected" / "Move to draft"
 * from the products table. Only ever touches the caller's own products —
 * ids that don't belong to her are silently dropped, not errored, since a
 * stale selection (another tab archived one mid-session) shouldn't block
 * the rest of the batch.
 */
export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = bulkListingStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const { ids, status } = parsed.data;

  if (status === 'active') {
    // Item 38 (2026-09-09) — same unified mandatory-info gate as the
    // single-listing publish route (see lib/seller-readiness.ts). The
    // seller-level half only needs checking once for the whole batch; the
    // listing-specific half (wallet balance per sellerType, shipping/
    // pickup address) runs per selected listing, since a batch can mix
    // product and service listings with different shipping/pickup setups.
    const sellerGate = await checkSellerMandatoryVerification(sellerId);
    if (!sellerGate.ok) {
      return NextResponse.json({ error: sellerGate.error, code: sellerGate.code }, { status: 403 });
    }

    const rows = await db
      .select({
        id: listings.id,
        subcategoryId: listings.subcategoryId,
        listingType: subcategories.listingType,
        shippingMethod: listings.shippingMethod,
        pickupEnabled: listings.pickupEnabled,
        pickupAddressSource: listings.pickupAddressSource,
        pickupOtherAddressLine1: listings.pickupOtherAddressLine1,
        pickupOtherAddressLine2: listings.pickupOtherAddressLine2,
        pickupOtherAddressCity: listings.pickupOtherAddressCity,
        pickupOtherAddressState: listings.pickupOtherAddressState,
        pickupOtherAddressPincode: listings.pickupOtherAddressPincode,
      })
      .from(listings)
      .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
      .where(and(inArray(listings.id, ids), eq(listings.sellerId, sellerId)));

    for (const row of rows) {
      const listingGate = await checkListingMandatoryInfo(sellerId, row);
      if (!listingGate.ok) {
        return NextResponse.json({ error: listingGate.error, code: listingGate.code }, { status: 403 });
      }
      // Real, pre-existing gap found while working on item 38: this route
      // never called the subscription-plan gate at all (only the single-
      // listing PATCH route did) — a seller with zero active plan could
      // bulk-publish listings that a one-at-a-time publish correctly
      // blocked. Same gate, same call, now run for every listing here too.
      const planGate = await checkPublishGate({
        id: row.id,
        sellerId,
        subcategoryId: row.subcategoryId,
        pickupEnabled: row.pickupEnabled,
        pickupAddressSource: row.pickupAddressSource,
        shippingMethod: row.shippingMethod,
      });
      if (!planGate.ok) {
        return NextResponse.json({ error: planGate.error, code: planGate.code }, { status: 403 });
      }
    }
  }

  const updated = await db
    .update(listings)
    .set({ status })
    .where(and(inArray(listings.id, ids), eq(listings.sellerId, sellerId)))
    .returning({ id: listings.id });

  return NextResponse.json({ updatedIds: updated.map((row) => row.id) });
}
