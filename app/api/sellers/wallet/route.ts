import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { getWalletWithHistory } from '@/lib/wallet';

/**
 * GET /api/sellers/wallet — her recharge-mode balance and the last 50
 * transactions behind it (topups, commission deductions, admin
 * adjustments). Works even for a seller who's never opted into recharge —
 * the wallet row is created lazily at ₹0, same reasoning as every other
 * "never a not-configured-yet state" resource in this codebase.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { wallet, transactions } = await getWalletWithHistory(Number(session.sub));
  return NextResponse.json({ wallet, transactions });
}
