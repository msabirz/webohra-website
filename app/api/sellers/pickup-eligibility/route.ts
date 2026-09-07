import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, jamaats, webohraOffices, subscriptionSettings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { getActivePlan, type SellerType } from '@/lib/subscriptions';

/**
 * GET /api/sellers/pickup-eligibility?sellerType=product|service — "can I
 * even show her the 'A WeBohra office' option" (2026-09-06). Didn't exist
 * before this — the product form had no way to check either half of the
 * gate. THREE conditions have to hold together, not any one alone:
 *  (0) the global office-pickup switch is on (subscription_settings.
 *      pickupOfficeFeatureEnabled, item 26, 2026-09-07) — admin's
 *      one-move kill switch for the whole feature, checked first so a
 *      single flip doesn't require touching every plan or every office;
 *  (a) her active plan for this sellerType includes pickupOfficeOption
 *      (Gold/Diamond product plans only), and
 *  (b) her jamaat is actually mapped to an office, and that office is
 *      active.
 * `checkPublishGate` (lib/subscriptions.ts) already enforces (0) and (a)
 * at publish time server-side — this is what lets the form know *before*
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

  const [settings] = await db.select().from(subscriptionSettings).limit(1);
  if (settings && !settings.pickupOfficeFeatureEnabled) {
    return NextResponse.json({ officeAvailable: false });
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
