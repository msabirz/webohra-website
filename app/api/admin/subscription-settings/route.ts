import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { subscriptionSettings } from '@/db/schema';
import { adminSubscriptionSettingsUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';

/**
 * /api/admin/subscription-settings — the platform-wide numbers that aren't
 * per-plan: the recharge-model wallet floor, which plan a recharge seller
 * defaults to, and WeBohra's cut of a bonus-listing sale (see the
 * Fulfillment & Subscriptions planning doc, item 8/11). Deliberately a
 * single row — GET lazily creates it with the schema's own defaults the
 * first time anyone asks, so there's never a "not configured yet" state
 * for the admin UI to handle.
 */
async function getOrCreateSettingsRow() {
  const [existing] = await db.select().from(subscriptionSettings).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(subscriptionSettings).values({}).returning();
  return created;
}

export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settings = await getOrCreateSettingsRow();
  return NextResponse.json({ settings });
}

export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubscriptionSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const current = await getOrCreateSettingsRow();
  const { walletMinThreshold, bonusListingCommissionPercent, ...rest } = parsed.data;
  const [updated] = await db
    .update(subscriptionSettings)
    .set({
      ...rest,
      ...(walletMinThreshold !== undefined && { walletMinThreshold: walletMinThreshold.toFixed(2) }),
      ...(bonusListingCommissionPercent !== undefined && {
        bonusListingCommissionPercent: bonusListingCommissionPercent.toFixed(2),
      }),
      updatedAt: new Date(),
    })
    .where(eq(subscriptionSettings.id, current.id))
    .returning();

  return NextResponse.json({ settings: updated });
}
