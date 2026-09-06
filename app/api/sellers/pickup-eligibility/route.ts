import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, jamaats, webohraOffices } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { getActivePlan, type SellerType } from '@/lib/subscriptions';

/**
 * GET /api/sellers/pickup-eligibility?sellerType=product|service — "can I
 * even show her the 'A WeBohra office' option" (2026-09-06). Didn't exist
 * before this — the product form had no way to check either half of the
 * gate. Both conditions have to hold together, not either alone:
 *  (a) her active plan for this sellerType includes pickupOfficeOption
 *      (Gold/Diamond product plans only), and
 *  (b) her jamaat is actually mapped to an office, and that office is
 *      active.
 * `checkPublishGate` (lib/subscriptions.ts) already enforces (a) at
 * publish time server-side — this is what lets the form know *before*
 * that, so it never shows a choice she can't actually use.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const url = new URL(request.url);
  const sellerType = url.searchParams.get('sellerType');
  if (sellerType !== 'product' && sellerType !== 'service') {
    return NextResponse.json({ error: 'sellerType must be "product" or "service"' }, { status: 400 });
  }

  const sellerId = Number(session.sub);
  const [plan, [profile]] = await Promise.all([
    getActivePlan(sellerId, sellerType as SellerType),
    db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId)),
  ]);

  if (!plan?.pickupOfficeOption || !profile?.jamaatId) {
    return NextResponse.json({ officeAvailable: false });
  }

  const [jamaat] = await db.select().from(jamaats).where(eq(jamaats.id, profile.jamaatId));
  if (!jamaat?.officeId) {
    return NextResponse.json({ officeAvailable: false });
  }

  const [office] = await db.select().from(webohraOffices).where(eq(webohraOffices.id, jamaat.officeId));
  return NextResponse.json({ officeAvailable: Boolean(office?.active) });
}
