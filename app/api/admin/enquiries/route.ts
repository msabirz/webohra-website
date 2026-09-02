import { NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries, listings, sellerProfiles } from '@/db/schema';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

const SLOW_ENQUIRY_HOURS = 24;
// "Awaiting a seller decision" — not yet accepted or rejected.
const OPEN_STATUSES = ['initiated', 'viewed'] as const;

/**
 * GET /api/admin/enquiries — every Take Consultation request (FR-21–27,
 * redesigned per the requester: initiated -> viewed -> accepted/rejected,
 * see enquiryStatusEnum's comment in db/schema.ts). Each row carries
 * `slow: boolean` — open (not yet accepted/rejected) for more than 24h
 * (FR-25's response-time flag), visible to Admin same as it is to the
 * seller in her own portal. ?status= filters.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const conditions = [];
  if (status) conditions.push(eq(enquiries.status, status as (typeof enquiries.status.enumValues)[number]));

  const rows = await db
    .select({
      id: enquiries.id,
      requestNumber: enquiries.requestNumber,
      status: enquiries.status,
      createdAt: enquiries.createdAt,
      listingTitle: listings.title,
      variantName: enquiries.variantName,
      businessName: sellerProfiles.businessName,
      buyerName: enquiries.buyerName,
      buyerPhone: enquiries.buyerPhone,
    })
    .from(enquiries)
    .innerJoin(listings, eq(enquiries.listingId, listings.id))
    .leftJoin(sellerProfiles, eq(sellerProfiles.userId, enquiries.sellerId))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(enquiries.createdAt));

  const slowCutoffMs = Date.now() - SLOW_ENQUIRY_HOURS * 60 * 60 * 1000;
  const reminderCutoffMs = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const isOpen = (status: string) => (OPEN_STATUSES as readonly string[]).includes(status);

  return NextResponse.json({
    enquiries: rows.map((row) => ({
      ...row,
      slow: isOpen(row.status) && row.createdAt.getTime() < slowCutoffMs,
      // FR-27: a reminder nudge is due once open 7+ days — no actual send
      // channel exists yet, so this only ever surfaces as a visible flag
      // here, never a notification we didn't really deliver.
      needsReminder: isOpen(row.status) && row.createdAt.getTime() < reminderCutoffMs,
    })),
  });
}
