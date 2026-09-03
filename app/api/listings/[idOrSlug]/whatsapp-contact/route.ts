import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, users, whatsappContacts, listingVariants, subcategories } from '@/db/schema';
import { whatsappContactSchema } from '@/lib/validation';
import { getActivePlan } from '@/lib/subscriptions';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/whatsapp-contact
 *
 * FR-5's real mechanism for a product: a direct, buyer-initiated WhatsApp
 * deep link to the seller's own number — no relay. The seller's phone is
 * only ever surfaced here, at the moment of this specific action (FR-37:
 * never as general browsable listing data — see the sellerPhone exclusion
 * on GET /api/listings/[idOrSlug]). Logs the click for the seller/
 * analytics; the actual conversation happens entirely in WhatsApp, outside
 * this platform's view.
 *
 * Also the Silver-tier mechanism for a SERVICE listing (service
 * contact-tiering, 2026-09-03 — see contactModeEnum's own comment in
 * db/schema.ts): gated here to only work when her active service plan's
 * contactMode is genuinely 'direct_whatsapp' — a product is never gated
 * (contactMode only ever means something for a service), and a Basic
 * ('whatsapp_number', shown directly on the page instead) or Gold
 * ('masked_relay', no number exposed at all) service seller must never
 * reach this even if the client tries to call it directly.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ idOrSlug: string }> },
) {
  const { idOrSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = whatsappContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [row] = await db
    .select({
      id: listings.id,
      status: listings.status,
      title: listings.title,
      sellerId: listings.sellerId,
      sellerPhone: users.phone,
      listingType: subcategories.listingType,
    })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .innerJoin(subcategories, eq(listings.subcategoryId, subcategories.id))
    .where(resolveListingCondition(idOrSlug));

  if (!row || row.status !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }

  if (row.listingType !== 'physical_product') {
    const plan = await getActivePlan(row.sellerId, 'service');
    const contactMode = plan?.contactMode ?? 'masked_relay';
    if (contactMode !== 'direct_whatsapp') {
      return NextResponse.json(
        { error: 'This seller doesn\'t use direct WhatsApp contact — use Take Consultation instead.' },
        { status: 409 },
      );
    }
  }

  let variantName: string | null = null;
  if (parsed.data.variantId !== undefined) {
    const [variant] = await db.select().from(listingVariants).where(eq(listingVariants.id, parsed.data.variantId));
    if (!variant || variant.listingId !== row.id) {
      return NextResponse.json({ error: 'That type is no longer available' }, { status: 409 });
    }
    variantName = variant.name;
  }

  await db.insert(whatsappContacts).values({
    listingId: row.id,
    sellerId: row.sellerId,
    buyerName: parsed.data.buyerName,
  });

  const isService = row.listingType !== 'physical_product';
  const message = variantName
    ? `Hi, ${parsed.data.buyerName} here — I'd like to ask about "${variantName}" for "${row.title}" on WE Bohra.`
    : isService
      ? `Hi, ${parsed.data.buyerName} here — I'd like to ask about "${row.title}" on WE Bohra.`
      : `Hi, ${parsed.data.buyerName} here — I'd like to buy "${row.title}" from WE Bohra.`;

  return NextResponse.json({ sellerPhone: row.sellerPhone, message });
}
