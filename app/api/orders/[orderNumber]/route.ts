import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, listings, sellerProfiles, subcategories, shipments } from '@/db/schema';
import { getRazorpayKeyId } from '@/lib/razorpay';

/**
 * GET /api/orders/[orderNumber]
 *
 * Buyer-facing order confirmation — reachable by anyone with the order
 * number (a receipt link, same trust model as a typical guest-checkout
 * confirmation page — and why it's a random code, not the raw sequential
 * id, see generateOrderNumber() in lib/ids.ts). Includes the shipping
 * address back since it's her own receipt, but never buyerPhone/buyerEmail
 * beyond what she already knows — kept out of the response to limit what a
 * leaked link exposes.
 *
 * Includes paymentStatus and (only while still pending/failed) razorpayOrderId
 * — Fulfillment & Subscriptions redesign, Phase 5b — so her own order page
 * can show a real "payment pending"/"payment failed" state and let her
 * reopen the SAME Razorpay order to retry, rather than silently pretending
 * every order shown here is already confirmed. razorpayOrderId is withheld
 * once paid; nothing needs it anymore at that point.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const { orderNumber } = await params;

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const items = await db
    .select({
      id: orderItems.id,
      listingId: orderItems.listingId,
      quantity: orderItems.quantity,
      unitPrice: orderItems.unitPrice,
      title: listings.title,
      subcategoryName: subcategories.name,
      businessName: sellerProfiles.businessName,
      variantName: orderItems.variantName,
      status: orderItems.status,
      statusUpdatedAt: orderItems.statusUpdatedAt,
    })
    .from(orderItems)
    .innerJoin(listings, eq(orderItems.listingId, listings.id))
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, orderItems.sellerId))
    .where(eq(orderItems.orderId, order.id));

  // Fulfillment & Subscriptions redesign, Phase 3 — one row per (seller,
  // method); charge is null for a method with no real cost yet (Delhivery).
  const orderShipments = await db
    .select({
      sellerId: shipments.sellerId,
      method: shipments.method,
      charge: shipments.charge,
      businessName: sellerProfiles.businessName,
    })
    .from(shipments)
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, shipments.sellerId))
    .where(eq(shipments.orderId, order.id));

  // Only needed to reopen Razorpay's checkout for a retry — an already-paid,
  // refunded, or COD order has nothing to retry, so this stays null for all
  // three, rather than handing back a live payment amount/key nobody asked
  // for. Explicit allow-list (pending/failed), not "!== 'paid'" — see
  // app/(minimal)/order/[orderNumber]/page.tsx's own comment on why
  // 'refunded' (added 2026-09-03) must never be treated as retryable.
  const retryable =
    order.paymentMethod === 'online' &&
    (order.paymentStatus === 'pending' || order.paymentStatus === 'failed') &&
    order.razorpayOrderId;
  const retryAmountRupees = retryable
    ? items.reduce((sum, i) => sum + Number(i.unitPrice) * i.quantity, 0) +
      orderShipments.reduce((sum, s) => sum + Number(s.charge ?? 0), 0)
    : null;

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      razorpayOrderId: retryable ? order.razorpayOrderId : null,
      razorpayKeyId: retryable ? getRazorpayKeyId() : null,
      retryAmountRupees,
      status: order.status,
      createdAt: order.createdAt,
    },
    items,
    shipments: orderShipments,
  });
}
