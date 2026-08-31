import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries, listings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * POST /api/sellers/enquiries/[id]/accept
 *
 * Clicking "Connect on WhatsApp" IS the accept action, per the requester's
 * explicit design — this marks the request accepted and hands back the
 * buyer's phone + a pre-filled message so the client opens wa.me itself
 * (the seller messages the customer directly, mirroring how buyer-initiated
 * WhatsApp contact already works elsewhere on the site). Idempotent: if
 * she's already accepted, this just re-returns the same contact details
 * without touching respondedAt again — she can reopen the chat anytime.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { id } = await params;
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, Number(id)));
  if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (enquiry.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const [listing] = await db.select().from(listings).where(eq(listings.id, enquiry.listingId));

  if (enquiry.status !== 'accepted') {
    await db
      .update(enquiries)
      .set({ status: 'accepted', respondedAt: new Date() })
      .where(eq(enquiries.id, enquiry.id));
  }

  const message = `Hi ${enquiry.buyerName}, this is regarding your consultation request for "${listing?.title ?? 'your enquiry'}" on WE Bohra.`;

  return NextResponse.json({ buyerPhone: enquiry.buyerPhone, message });
}
