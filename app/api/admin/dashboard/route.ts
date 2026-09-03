import { NextResponse } from 'next/server';
import { and, count, eq, gte, inArray, lt, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  users,
  sellerProfiles,
  listings,
  categories,
  subcategories,
  orders,
  orderItems,
  enquiries,
  whatsappContacts,
  pickupRequests,
} from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

const SLOW_ENQUIRY_HOURS = 24;

/**
 * GET /api/admin/dashboard — FR-15's "basic analytics": listings per
 * category, active sellers, WhatsApp handoff volume, enquiry volume, and
 * seller response-time flags, plus enough order/pickup context for Admin to
 * see the whole platform at a glance without digging into each section.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const slowCutoff = new Date(Date.now() - SLOW_ENQUIRY_HOURS * 60 * 60 * 1000);

  const [
    [{ totalBuyers }],
    [{ totalSellers }],
    [{ verifiedSellers }],
    [{ pendingVerification }],
    [{ totalListings }],
    [{ activeListings }],
    [{ draftListings }],
    [{ flaggedListings }],
    listingsByCategory,
    [{ totalOrders }],
    [{ ordersLast30d }],
    [{ totalEnquiries }],
    [{ pendingEnquiries }],
    [{ slowEnquiries }],
    [{ totalWhatsappContacts }],
    [{ pendingPickups }],
  ] = await Promise.all([
    db.select({ totalBuyers: count() }).from(users).where(eq(users.phoneVerified, true)),
    db.select({ totalSellers: count() }).from(sellerProfiles),
    db
      .select({ verifiedSellers: count() })
      .from(sellerProfiles)
      .innerJoin(users, eq(sellerProfiles.userId, users.id))
      .where(eq(users.itsVerified, true)),
    db
      .select({ pendingVerification: count() })
      .from(sellerProfiles)
      .innerJoin(users, eq(sellerProfiles.userId, users.id))
      .where(eq(users.itsVerified, false)),
    db.select({ totalListings: count() }).from(listings),
    db.select({ activeListings: count() }).from(listings).where(eq(listings.status, 'active')),
    db.select({ draftListings: count() }).from(listings).where(eq(listings.status, 'draft')),
    db.select({ flaggedListings: count() }).from(listings).where(eq(listings.status, 'flagged')),
    db
      .select({ categoryName: categories.name, count: count(listings.id) })
      .from(categories)
      .leftJoin(subcategories, eq(subcategories.categoryId, categories.id))
      .leftJoin(listings, eq(listings.subcategoryId, subcategories.id))
      .groupBy(categories.id, categories.name)
      .orderBy(categories.name),
    db.select({ totalOrders: count() }).from(orders),
    db.select({ ordersLast30d: count() }).from(orders).where(gte(orders.createdAt, thirtyDaysAgo)),
    db.select({ totalEnquiries: count() }).from(enquiries),
    db
      .select({ pendingEnquiries: count() })
      .from(enquiries)
      .where(inArray(enquiries.status, ['initiated', 'viewed'])),
    db
      .select({ slowEnquiries: count() })
      .from(enquiries)
      .where(and(inArray(enquiries.status, ['initiated', 'viewed']), lt(enquiries.createdAt, slowCutoff))),
    db.select({ totalWhatsappContacts: count() }).from(whatsappContacts),
    db.select({ pendingPickups: count() }).from(pickupRequests).where(eq(pickupRequests.status, 'pending')),
  ]);

  // Fulfillment & Subscriptions redesign, Phase 5b — an 'online' order that
  // hasn't actually cleared payment yet must never count toward GMV; a COD
  // order always did (it was never in a payment pipeline to begin with),
  // so this only excludes the specific online+unpaid case, not COD.
  const [{ gmv }] = await db
    .select({ gmv: sql<string>`coalesce(sum(${orderItems.unitPrice} * ${orderItems.quantity}), 0)` })
    .from(orderItems)
    .innerJoin(orders, eq(orderItems.orderId, orders.id))
    .where(
      and(
        eq(orders.status, 'placed'),
        or(ne(orders.paymentMethod, 'online'), eq(orders.paymentStatus, 'paid')),
      ),
    );

  return NextResponse.json({
    sellers: {
      total: totalSellers,
      verified: verifiedSellers,
      pendingVerification,
    },
    buyers: { total: totalBuyers },
    listings: {
      total: totalListings,
      active: activeListings,
      draft: draftListings,
      flagged: flaggedListings,
      byCategory: listingsByCategory,
    },
    orders: {
      total: totalOrders,
      last30d: ordersLast30d,
      grossValue: Number(gmv),
    },
    enquiries: {
      total: totalEnquiries,
      pending: pendingEnquiries,
      slow: slowEnquiries,
    },
    whatsappContacts: { total: totalWhatsappContacts },
    pickups: { pending: pendingPickups },
  });
}
