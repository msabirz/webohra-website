import { NextResponse } from 'next/server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/index';
import {
  orders,
  orderItems,
  listings,
  sellerProfiles,
  subcategories,
  shipments,
  payouts,
  refunds,
  disputes,
  disputeComments,
  users,
} from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';
import { isForwardMove, isOrderItemStage } from '@/lib/order-item-status';
import { getRefundedAmount, getOrderPayoutWarning } from '@/lib/refunds';
import { computeOrderTotalRupees } from '@/lib/order-total';

/**
 * GET /api/admin/orders/[orderNumber] — the "whole transaction" view Admin
 * Panel transaction/dispute/refund tooling (2026-09-03) exists for:
 * everything about one order in a single place — buyer contact + shipping
 * (unlike the buyer-facing GET /api/orders/[orderNumber], this includes
 * phone/email, since Admin legitimately needs to reach her), the real
 * payment record (razorpayOrderId/PaymentId, not withheld the way the
 * buyer-facing route withholds them once paid), every seller's item/
 * shipment/payout status for this order, every refund attempt with the
 * running total refunded vs. still-refundable, and every dispute (with its
 * full comment timeline) ever opened against it. isStaff, not isAdmin —
 * Customer Support needs to see all of this to help a buyer; only the
 * money-moving actions (refund, the payout buttons) are isAdmin-gated at
 * their own routes.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const [items, orderShipments, orderPayouts, orderRefunds, orderDisputes] = await Promise.all([
    db
      .select({
        id: orderItems.id,
        listingId: orderItems.listingId,
        sellerId: orderItems.sellerId,
        quantity: orderItems.quantity,
        unitPrice: orderItems.unitPrice,
        title: listings.title,
        subcategoryName: subcategories.name,
        businessName: sellerProfiles.businessName,
        variantName: orderItems.variantName,
        status: orderItems.status,
        statusUpdatedAt: orderItems.statusUpdatedAt,
        cancelledReason: orderItems.cancelledReason,
      })
      .from(orderItems)
      .innerJoin(listings, eq(orderItems.listingId, listings.id))
      .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, orderItems.sellerId))
      .where(eq(orderItems.orderId, order.id)),
    db
      .select({
        sellerId: shipments.sellerId,
        method: shipments.method,
        charge: shipments.charge,
        businessName: sellerProfiles.businessName,
      })
      .from(shipments)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, shipments.sellerId))
      .where(eq(shipments.orderId, order.id)),
    db
      .select({
        id: payouts.id,
        sellerId: payouts.sellerId,
        businessName: sellerProfiles.businessName,
        netAmount: payouts.netAmount,
        status: payouts.status,
        channel: payouts.channel,
        processedAt: payouts.processedAt,
      })
      .from(payouts)
      .leftJoin(sellerProfiles, eq(sellerProfiles.userId, payouts.sellerId))
      .where(eq(payouts.orderId, order.id)),
    db.select().from(refunds).where(eq(refunds.orderId, order.id)).orderBy(desc(refunds.createdAt)),
    db.select().from(disputes).where(eq(disputes.orderId, order.id)).orderBy(desc(disputes.createdAt)),
  ]);

  const disputeIds = orderDisputes.map((d) => d.id);
  const comments = disputeIds.length
    ? await db
        .select({
          id: disputeComments.id,
          disputeId: disputeComments.disputeId,
          note: disputeComments.note,
          statusChangedTo: disputeComments.statusChangedTo,
          createdAt: disputeComments.createdAt,
          staffName: users.name,
          staffEmail: users.email,
        })
        .from(disputeComments)
        .leftJoin(users, eq(users.id, disputeComments.staffId))
        .where(inArray(disputeComments.disputeId, disputeIds))
        .orderBy(desc(disputeComments.createdAt))
    : [];

  const [total, refundedAmount, payoutWarning] = await Promise.all([
    computeOrderTotalRupees(order.id),
    getRefundedAmount(order.id),
    getOrderPayoutWarning(order.id),
  ]);

  return NextResponse.json({
    order: {
      orderNumber: order.orderNumber,
      buyerName: order.buyerName,
      buyerPhone: order.buyerPhone,
      buyerEmail: order.buyerEmail,
      addressLine1: order.addressLine1,
      addressLine2: order.addressLine2,
      city: order.city,
      state: order.state,
      pincode: order.pincode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      razorpayOrderId: order.razorpayOrderId,
      razorpayPaymentId: order.razorpayPaymentId,
      status: order.status,
      cancelledBy: order.cancelledBy,
      cancellationReason: order.cancellationReason,
      createdAt: order.createdAt,
    },
    items,
    shipments: orderShipments,
    payouts: orderPayouts,
    payment: {
      total,
      refundedAmount,
      remainingRefundable: Math.max(0, total - refundedAmount),
      refundable: order.paymentMethod === 'online' && (order.paymentStatus === 'paid' || order.paymentStatus === 'refunded'),
      payoutWarning,
    },
    refunds: orderRefunds,
    disputes: orderDisputes.map((d) => ({
      ...d,
      comments: comments.filter((c) => c.disputeId === d.id),
    })),
  });
}

/**
 * PATCH /api/admin/orders/[orderNumber] — staff override for a line item's
 * fulfillment status, on behalf of any seller (unlike the seller's own
 * PATCH /api/sellers/orders/[orderNumber], this one isn't scoped to a
 * single sellerId — Customer Support needs to be able to nudge any
 * seller's item forward). Body: { itemId, status }.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orderNumber: string }> },
) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { orderNumber } = await params;
  const body = await request.json().catch(() => null);
  const itemId = Number(body?.itemId);
  const status = body?.status;

  // Only a real fulfillment stage is a valid target here — 'cancelled'
  // (added 2026-09-03) has its own dedicated action
  // (POST .../cancel-items, which also handles the refund), never this
  // generic advance-status route.
  if (!itemId || !isOrderItemStage(status)) {
    return NextResponse.json({ error: 'itemId and a valid status are required' }, { status: 400 });
  }

  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber));
  if (!order) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (order.status === 'cancelled') {
    return NextResponse.json({ error: 'This order was cancelled.' }, { status: 400 });
  }
  if (order.paymentMethod === 'online' && order.paymentStatus !== 'paid') {
    // Advancing fulfillment on money that never arrived would defeat the
    // point of gating checkout on payment in the first place — even Admin
    // can look at a pending/failed/refunded online order (see the list
    // route's own comment), but can't move its items forward unless it's
    // currently actually 'paid' — a 'refunded' order (added 2026-09-03)
    // is deliberately blocked here too, same reasoning as the seller's
    // own PATCH route: fulfillment shouldn't advance once the money's
    // already gone back.
    return NextResponse.json(
      {
        error:
          order.paymentStatus === 'refunded'
            ? 'This order has been refunded — fulfillment can no longer be advanced.'
            : "This order hasn't been paid for yet.",
      },
      { status: 400 },
    );
  }

  const [item] = await db
    .select()
    .from(orderItems)
    .where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, order.id)));
  if (!item) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!isForwardMove(item.status, status)) {
    return NextResponse.json({ error: `Can't move status backward from ${item.status}.` }, { status: 400 });
  }

  const [updated] = await db
    .update(orderItems)
    .set({ status, statusUpdatedAt: new Date() })
    .where(eq(orderItems.id, itemId))
    .returning();

  return NextResponse.json({ item: updated });
}
