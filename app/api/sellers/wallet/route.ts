import { NextResponse } from 'next/server';
import { db } from '@/db/index';
import { subscriptionSettings } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { getWalletWithHistory } from '@/lib/wallet';

/**
 * GET /api/sellers/wallet — her recharge-mode balance and the last 50
 * transactions behind it (topups, commission deductions, admin
 * adjustments). Works even for a seller who's never opted into recharge —
 * the wallet row is created lazily at ₹0, same reasoning as every other
 * "never a not-configured-yet state" resource in this codebase.
 *
 * Also returns the admin-configured minimum top-up (₹500 as of
 * 2026-09-06, previously hardcoded) so the wallet page's label/validation
 * always matches what topup-order actually enforces, without a second
 * fetch just for one number.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const [{ wallet, transactions }, [settings]] = await Promise.all([
    getWalletWithHistory(Number(session.sub)),
    db.select().from(subscriptionSettings).limit(1),
  ]);
  return NextResponse.json({ wallet, transactions, minTopup: settings?.walletMinTopup ?? '500.00' });
}
