import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getSellerReadiness } from '@/lib/seller-readiness';

/**
 * GET /api/sellers/readiness — item 38 (2026-09-09). The seller-level half
 * of the mandatory publish gate (see lib/seller-readiness.ts), surfaced so
 * the portal can show her a real, live checklist instead of letting her
 * find out something's missing only when a publish attempt fails. Wallet
 * balance and shipping/pickup address completeness are deliberately not
 * part of this — both depend on which specific listing she's publishing,
 * not on her account as a whole.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const readiness = await getSellerReadiness(Number(session.sub));
  return NextResponse.json({ readiness });
}
