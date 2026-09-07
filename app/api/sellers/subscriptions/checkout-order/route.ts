import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionPlans } from '@/db/schema';
import { subscriptionCheckoutOrderSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { createRazorpayOrder, getRazorpayKeyId } from '@/lib/razorpay';
import { generateSubscriptionReceipt } from '@/lib/ids';

/**
 * POST /api/sellers/subscriptions/checkout-order — step one of buying a
 * PAID subscription plan (item 27, 2026-09-07). Same "create the order,
 * hand back what the Checkout widget needs, no state changes yet" shape
 * as /api/sellers/wallet/topup-order — nothing in `subscriptionPayments`
 * or `sellerSubscriptions` moves until a real signed payment comes back,
 * via /verify or the webhook.
 *
 * A free plan (monthlyPrice: 0) never reaches this route — the seller
 * form calls PUT /api/sellers/subscriptions directly for those, same as
 * before this feature existed. This route refuses a free plan explicitly
 * rather than silently creating a ₹0 Razorpay order.
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = subscriptionCheckoutOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { sellerType, planId } = parsed.data;
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, planId));
  if (!plan || !plan.active || plan.sellerType !== sellerType) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { planId: ['Select a valid, currently available plan'] } },
      { status: 400 },
    );
  }

  const priceRupees = Number(plan.monthlyPrice);
  if (priceRupees <= 0) {
    return NextResponse.json(
      { error: 'This plan is free — select it directly, no payment needed.' },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const order = await createRazorpayOrder({
    amountRupees: priceRupees,
    receipt: generateSubscriptionReceipt(),
    notes: {
      sellerId: String(sellerId),
      sellerType,
      planId: String(planId),
      purpose: 'subscription_purchase',
    },
  });

  return NextResponse.json({
    razorpayOrderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId: getRazorpayKeyId(),
  });
}
