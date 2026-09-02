import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, jamaats } from '@/db/schema';
import { sellerProfileUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * PATCH /api/sellers/profile — the settings page's "update her details".
 * Email, phone, and password have their own dedicated endpoints (see
 * /api/auth/profile and /api/auth/password/*, reused as-is since sellers
 * share the same users row/auth model as buyers) — this only covers
 * seller_profiles fields.
 */
export async function PATCH(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const userId = Number(session.sub);
  const [existing] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, userId));
  if (!existing) {
    return NextResponse.json({ error: 'No seller profile found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = sellerProfileUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { businessName, plansDelhiveryShipping, jamaatId, addressLine1, addressLine2, city, state, pincode } =
    parsed.data;

  if (plansDelhiveryShipping && jamaatId) {
    const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, jamaatId));
    if (!jamaat || !jamaat.active) {
      return NextResponse.json(
        { error: 'Select a valid jamaat', issues: { jamaatId: ['Select a valid jamaat'] } },
        { status: 400 },
      );
    }
  }

  const [updated] = await db
    .update(sellerProfiles)
    .set({
      businessName,
      jamaatId: plansDelhiveryShipping ? jamaatId : null,
      // Fulfillment & Subscriptions redesign, Phase 2 — only touched when
      // sent, so this same endpoint stays safe to call from forms that
      // don't include an address section at all.
      ...(addressLine1 !== undefined && { addressLine1 }),
      ...(addressLine2 !== undefined && { addressLine2: addressLine2 || null }),
      ...(city !== undefined && { city }),
      ...(state !== undefined && { state }),
      ...(pincode !== undefined && { pincode }),
    })
    .where(eq(sellerProfiles.userId, userId))
    .returning();

  return NextResponse.json({ sellerProfile: updated });
}
