import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, users, whatsappContacts } from '@/db/schema';
import { whatsappContactSchema } from '@/lib/validation';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/whatsapp-contact
 *
 * FR-5's actual mechanism: a direct, buyer-initiated WhatsApp deep link to
 * the seller's own number — no relay. The seller's phone is only ever
 * surfaced here, at the moment of this specific action (FR-37: never as
 * general browsable listing data — see the sellerPhone exclusion on GET
 * /api/listings/[idOrSlug]). Logs the click for the seller/analytics; the
 * actual conversation happens entirely in WhatsApp, outside this platform's
 * view.
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
    })
    .from(listings)
    .innerJoin(users, eq(listings.sellerId, users.id))
    .where(resolveListingCondition(idOrSlug));

  if (!row || row.status !== 'active') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 });
  }

  await db.insert(whatsappContacts).values({
    listingId: row.id,
    sellerId: row.sellerId,
    buyerName: parsed.data.buyerName,
  });

  const message = `Hi, ${parsed.data.buyerName} here — I'd like to buy "${row.title}" from WE Bohra.`;

  return NextResponse.json({ sellerPhone: row.sellerPhone, message });
}
