import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionPlans } from '@/db/schema';
import { adminSubscriptionPlanUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [plan] = await db.select().from(subscriptionPlans).where(eq(subscriptionPlans.id, Number(id)));
  if (!plan) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminSubscriptionPlanUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  if (parsed.data.contactMode && plan.sellerType === 'product') {
    return NextResponse.json(
      { error: 'Invalid input', issues: { contactMode: ['Only service plans have a contact mode'] } },
      { status: 400 },
    );
  }

  const { monthlyPrice, ...rest } = parsed.data;
  const [updated] = await db
    .update(subscriptionPlans)
    .set({
      ...rest,
      ...(monthlyPrice !== undefined && { monthlyPrice: monthlyPrice.toFixed(2) }),
    })
    .where(eq(subscriptionPlans.id, plan.id))
    .returning();

  return NextResponse.json({ plan: updated });
}
