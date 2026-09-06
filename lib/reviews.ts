import { and, avg, count, desc, eq, inArray, isNull } from 'drizzle-orm';
import { db } from '@/db/index';
import { reviews, orderItems, orders, listings, sellerProfiles } from '@/db/schema';

/**
 * Reviews & Ratings (Tier 3, item 17, 2026-09-06) — shared logic between
 * the buyer-facing /api/account/reviews endpoints and the public
 * /api/listings/[idOrSlug]/reviews one. Kept out of the route files the
 * same way lib/disputes.ts and lib/wallet.ts are, for the same reason:
 * more than one call site needs the exact same eligibility/aggregate
 * logic, and a route file re-deriving it independently is how these
 * subtly drift apart.
 */

/**
 * Delivered order items a buyer hasn't reviewed yet — what "My Reviews"
 * on /account offers her to rate. Only ever items from an order placed
 * while she was signed in (order.userId set) — see orders.userId's own
 * comment; a guest order has no account to attach a review to at all.
 */
export async function getEligibleOrderItemsForReview(buyerId: number) {
  const rows = await db
    .select({
      orderItemId: orderItems.id,
      orderNumber: orders.orderNumber,
      listingId: orderItems.listingId,
      listingTitle: listings.title,
      businessName: sellerProfiles.businessName,
      variantName: orderItems.variantName,
      quantity: orderItems.quantity,
      deliveredAt: orderItems.statusUpdatedAt,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(listings, eq(listings.id, orderItems.listingId))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, orderItems.sellerId))
    .leftJoin(reviews, eq(reviews.orderItemId, orderItems.id))
    .where(and(eq(orders.userId, buyerId), eq(orderItems.status, 'delivered'), isNull(reviews.id)))
    .orderBy(desc(orderItems.statusUpdatedAt));
  return rows;
}

/** Her own past reviews, most recent first — the "already rated" half of
 *  the same /account section, and what her edit form loads from. */
export async function getMyReviews(buyerId: number) {
  return db
    .select({
      id: reviews.id,
      orderItemId: reviews.orderItemId,
      listingId: reviews.listingId,
      listingTitle: listings.title,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .innerJoin(listings, eq(listings.id, reviews.listingId))
    .where(eq(reviews.buyerId, buyerId))
    .orderBy(desc(reviews.createdAt));
}

export type SubmitReviewResult =
  | { ok: true; review: typeof reviews.$inferSelect }
  | { ok: false; error: string };

/**
 * Verifies the order item is really hers, really delivered, and not
 * already reviewed before writing anything — the same shape of guard as
 * lib/disputes.ts's openDisputeAsSeller, just against a different set of
 * conditions. `buyerName` is snapshotted here, not looked up again later.
 */
export async function submitReview(
  buyerId: number,
  buyerName: string,
  orderItemId: number,
  rating: number,
  comment: string | null,
): Promise<SubmitReviewResult> {
  const [item] = await db
    .select({
      id: orderItems.id,
      status: orderItems.status,
      listingId: orderItems.listingId,
      sellerId: orderItems.sellerId,
      orderUserId: orders.userId,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(eq(orderItems.id, orderItemId));

  if (!item || item.orderUserId !== buyerId) {
    return { ok: false, error: 'Not found' };
  }
  if (item.status !== 'delivered') {
    return { ok: false, error: 'Only a delivered item can be reviewed.' };
  }

  const [existing] = await db.select().from(reviews).where(eq(reviews.orderItemId, orderItemId));
  if (existing) {
    return { ok: false, error: 'You already reviewed this — edit your existing review instead.' };
  }

  const [review] = await db
    .insert(reviews)
    .values({
      orderItemId,
      listingId: item.listingId,
      sellerId: item.sellerId,
      buyerId,
      buyerName,
      rating,
      comment: comment || null,
    })
    .returning();
  return { ok: true, review };
}

export type EditReviewResult = SubmitReviewResult;

/** She can revise her own review's rating/comment later — never anyone
 *  else's, enforced by the buyerId match below, not just a route-level
 *  ownership assumption. */
export async function editReview(
  reviewId: number,
  buyerId: number,
  rating: number,
  comment: string | null,
): Promise<EditReviewResult> {
  const [existing] = await db.select().from(reviews).where(eq(reviews.id, reviewId));
  if (!existing || existing.buyerId !== buyerId) {
    return { ok: false, error: 'Not found' };
  }
  const [review] = await db
    .update(reviews)
    .set({ rating, comment: comment || null, updatedAt: new Date() })
    .where(eq(reviews.id, reviewId))
    .returning();
  return { ok: true, review };
}

/** Public aggregate + list for a listing's PDP/SDP — average rounded to
 *  one decimal (null, not 0, when there are no reviews yet, so the UI can
 *  tell "no rating" apart from "rated 0"), newest review first. Capped at
 *  50, same "no pagination UI for v1" convention as wallet transaction
 *  history and admin dispute lists elsewhere in this codebase. */
export async function getListingReviews(listingId: number) {
  const [agg] = await db
    .select({ average: avg(reviews.rating), count: count(reviews.id) })
    .from(reviews)
    .where(eq(reviews.listingId, listingId));

  const list = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      buyerName: reviews.buyerName,
      createdAt: reviews.createdAt,
      updatedAt: reviews.updatedAt,
    })
    .from(reviews)
    .where(eq(reviews.listingId, listingId))
    .orderBy(desc(reviews.createdAt))
    .limit(50);

  return {
    average: agg?.average ? Math.round(Number(agg.average) * 10) / 10 : null,
    count: agg?.count ?? 0,
    reviews: list,
  };
}

/** Bulk version for listing grids (collection/category pages, search) —
 *  one query for N listings instead of N round trips. Returns a Map so a
 *  caller can look up by listingId and default to "no rating" for any id
 *  not present (a listing with zero reviews never gets a row here). */
export async function getListingRatingSummaries(listingIds: number[]) {
  if (listingIds.length === 0) return new Map<number, { average: number; count: number }>();
  const rows = await db
    .select({ listingId: reviews.listingId, average: avg(reviews.rating), count: count(reviews.id) })
    .from(reviews)
    .where(inArray(reviews.listingId, listingIds))
    .groupBy(reviews.listingId);
  const map = new Map<number, { average: number; count: number }>();
  for (const row of rows) {
    map.set(row.listingId, { average: Math.round(Number(row.average) * 10) / 10, count: row.count });
  }
  return map;
}
