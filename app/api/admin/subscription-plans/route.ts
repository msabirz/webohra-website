import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionPlans } from '@/db/schema';
import { adminSubscriptionPlanCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/subscription-plans — every gate here is a plain, admin-edited
 * column (price, listing cap, Pickup & Pay/Delhivery access, priority
 * support, reminders, contact mode, bonus-category listings), never logic
 * keyed off a tier name in code (see the Fulfillment & Subscriptions
 * planning doc's "admin manageability" answer). ?sellerType= filters.
 * Archived via `active`, never deleted — a seller already on a retired
 * plan keeps working exactly as before, same reasoning as
 * subcategory_fields.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const sellerType = url.searchParams.get('sellerType');
  const conditions =
    sellerType === 'product' || sellerType === 'service' ? eq(subscriptionPlans.sellerType, sellerType) : undefined;

  const list = await db
    .select()
    .from(subscriptionPlans)
    .where(conditions)
    .orderBy(asc(subscriptionPlans.sellerType), asc(subscriptionPlans.sortOrder));

  return NextResponse.json({ plans: list });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubscriptionPlanCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // contactMode only ever means something for a service plan — reject
  // rather than silently accept dead data on a product plan.
  if (parsed.data.sellerType === 'product' && parsed.data.contactMode) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { contactMode: ['Only service plans have a contact mode'] } },
      { status: 400 },
    );
  }

  const [existing] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.tierKey, parsed.data.tierKey));
  if (existing && existing.sellerType === parsed.data.sellerType) {
    return NextResponse.json(
      { error: 'Invalid input', issues: { tierKey: ['A plan with this key already exists for this seller type'] } },
      { status: 400 },
    );
  }

  const { monthlyPrice, ...rest } = parsed.data;
  const [plan] = await db
    .insert(subscriptionPlans)
    .values({ ...rest, monthlyPrice: monthlyPrice.toFixed(2) })
    .returning();

  return NextResponse.json({ plan }, { status: 201 });
}
