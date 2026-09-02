import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { pickupRequests } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * PATCH /api/sellers/pickup-requests/[id] — "mark ready for pickup"
 * (planning doc Decision 5's other reveal trigger, alongside
 * listings.showAddressOnPdp): sets readyForPickupAt, which is what makes
 * the buyer's own tracking page start showing the real address for this
 * one request — even when the listing itself keeps its address hidden by
 * default. One-way and idempotent: calling it again on an already-ready
 * request just returns the current state rather than erroring, same
 * "never fabricate progress it can't back up, never let it un-happen
 * either" rule as order_item status.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { id } = await params;
  const sellerId = Number(session.sub);

  const [existing] = await db
    .select()
    .from(pickupRequests)
    .where(and(eq(pickupRequests.id, Number(id)), eq(pickupRequests.sellerId, sellerId)));
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (existing.readyForPickupAt) {
    return NextResponse.json({ pickup: existing });
  }

  const [updated] = await db
    .update(pickupRequests)
    .set({ readyForPickupAt: new Date() })
    .where(eq(pickupRequests.id, existing.id))
    .returning();

  return NextResponse.json({ pickup: updated });
}
