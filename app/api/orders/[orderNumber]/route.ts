import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { orders, orderItems, listings, sellerProfiles, subcategories } from '@/db/schema';

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
      status: orderItems.status,
      statusUpdatedAt: orderItems.statusUpdatedAt,
    })
    .from(orderItems)
    .innerJoin(listings, eq(orderItems.listingId, listings.id))
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, orderItems.sellerId))
    .where(eq(orderItems.orderId, order.id));

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
      status: order.status,
      createdAt: order.createdAt,
    },
    items,
  });
}
