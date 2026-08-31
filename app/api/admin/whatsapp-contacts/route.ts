import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { whatsappContacts, listings, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/** GET /api/admin/whatsapp-contacts — FR-15's "WhatsApp order handoff
 *  volume" log: every "Buy on WhatsApp" click, tracking-only (the actual
 *  conversation happens entirely off-platform). */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rows = await db
    .select({
      id: whatsappContacts.id,
      buyerName: whatsappContacts.buyerName,
      createdAt: whatsappContacts.createdAt,
      listingTitle: listings.title,
      businessName: sellerProfiles.businessName,
    })
    .from(whatsappContacts)
    .innerJoin(listings, eq(whatsappContacts.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, whatsappContacts.sellerId))
    .orderBy(desc(whatsappContacts.createdAt))
    .limit(200);

  return NextResponse.json({ contacts: rows });
}
