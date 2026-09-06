import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { listings, users, whatsappContacts, listingVariants, subcategories } from '@/db/schema';
import { whatsappContactSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { getActivePlan } from '@/lib/subscriptions';
import { checkConnectEligibility, sendConnectNotification } from '@/lib/whatsapp-connect';

function resolveListingCondition(idOrSlug: string) {
  const asNumber = Number(idOrSlug);
  return Number.isInteger(asNumber) ? eq(listings.id, asNumber) : eq(listings.slug, idOrSlug);
}

/**
 * POST /api/listings/[idOrSlug]/whatsapp-contact
 *
 * FR-5's buyer-initiated WhatsApp deep link — unchanged, still a direct,
 * instant, form-free tap straight to the seller's own number, no relay
 * (see components/whatsapp-buy-button.tsx). What changed underneath
 * (WhatsApp Connect & Lead — Meta Direct, Tier 3 item 19, 2026-09-06):
 * this is now the trackable, billable "Connect" event the finalized
 * design describes — session-gated (registered-buyers-only, bringing
 * this in line with the contact model's general rule — see
 * webohra-site/CLAUDE.md), and it fires a separate, real WhatsApp
 * Business Platform notification to the SELLER in the background (see
 * lib/whatsapp-connect.ts's own top comment for why that's the billable
 * message, not the buyer's own wa.me redirect). Dedupe/rate-limit/
 * wallet-balance are all handled by checkConnectEligibility; only the
 * insufficient-wallet case actually blocks this response — dedupe and
 * rate-limit silently skip the paid notification while still letting the
 * buyer's own redirect happen exactly as before.
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
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in to contact a seller' }, { status: 401 });
  }
  const buyerId = Number(session.sub);

  const { idOrSlug } = await params;

  const body = await request.json().catch(() => null);
  const parsed = whatsappContactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [buyer] = await db.select({ name: users.name }).from(users).where(eq(users.id, buyerId));
  const buyerName = buyer?.name?.trim() || 'A WE Bohra buyer';

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

  const eligibility = await checkConnectEligibility(buyerId, row.id, row.sellerId);
  if (!eligibility.ok) {
    return NextResponse.json({ error: eligibility.error }, { status: 409 });
  }
  if (eligibility.billable) {
    await sendConnectNotification({
      listingId: row.id,
      sellerId: row.sellerId,
      buyerId,
      sellerPhone: row.sellerPhone,
      buyerName,
      listingTitle: row.title,
    });
  }

  await db.insert(whatsappContacts).values({
    listingId: row.id,
    sellerId: row.sellerId,
    buyerName,
  });

  const isService = row.listingType !== 'physical_product';
  const message = variantName
    ? `Hi, ${buyerName} here — I'd like to ask about "${variantName}" for "${row.title}" on WE Bohra.`
    : isService
      ? `Hi, ${buyerName} here — I'd like to ask about "${row.title}" on WE Bohra.`
      : `Hi, ${buyerName} here — I'd like to buy "${row.title}" from WE Bohra.`;

  return NextResponse.json({ sellerPhone: row.sellerPhone, message });
}
