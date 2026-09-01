import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, enquiries, users, listingVariants } from '@/db/schema';
import { consultationRequestSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { generateRequestNumber } from '@/lib/ids';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/consultation-request
 *
 * "Take Consultation", redesigned per the requester's explicit call: this
 * no longer opens WhatsApp for the buyer directly (that was FR-21's
 * original mechanism). Instead it creates a trackable request — notifying
 * the seller in her portal — and she's the one who opens WhatsApp, which
 * IS her acceptance (see POST .../accept). Guest-submittable: buyerName/
 * buyerPhone are always captured directly (same shape as guest checkout),
 * buyerId is only set when she's actually signed in.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = consultationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [listing] = await db.select().from(listings).where(resolveListingCondition(idOrSlug));
  if (!listing || listing.status !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }

  // Same either/or as checkout: a variant-based listing needs a real
  // variant picked (never a bare "consultation about nothing specific"),
  // and a simple listing never carries one.
  let variantId: number | null = null;
  let variantName: string | null = null;
  if (parsed.data.variantId !== undefined) {
    const [variant] = await db
      .select()
      .from(listingVariants)
      .where(eq(listingVariants.id, parsed.data.variantId));
    if (!variant || variant.listingId !== listing.id) {
      return NextResponse.json({ error: 'That type is no longer available' }, { status: 409 });
    }
    variantId = variant.id;
    variantName = variant.name;
  } else if (listing.price === null) {
    return NextResponse.json(
      { error: 'This listing has different types — pick one before requesting a consultation' },
      { status: 409 },
    );
  }

  const session = await getSessionFromRequest(request);
  let buyerId: number | null = null;
  if (session) {
    const [user] = await db.select().from(users).where(eq(users.id, Number(session.sub)));
    if (user) buyerId = user.id;
  }

  const requestNumber = generateRequestNumber();
  const [enquiry] = await db
    .insert(enquiries)
    .values({
      requestNumber,
      buyerId,
      buyerName: parsed.data.buyerName,
      buyerPhone: parsed.data.buyerPhone,
      message: parsed.data.message || null,
      sellerId: listing.sellerId,
      listingId: listing.id,
      variantId,
      variantName,
      status: 'initiated',
    })
    .returning();

  return NextResponse.json({ requestNumber: enquiry.requestNumber }, { status: 201 });
}
