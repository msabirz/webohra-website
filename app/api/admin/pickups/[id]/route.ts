import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { pickupRequests } from '@/db/schema';
import { adminPickupUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

/** PATCH /api/admin/pickups/[id] — Customer Support logs a parcel as
 *  received, or flags an issue. Records who and when. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [pickup] = await db.select().from(pickupRequests).where(eq(pickupRequests.id, Number(id)));
  if (!pickup) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminPickupUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(pickupRequests)
    .set({
      status: parsed.data.status,
      notes: parsed.data.notes,
      handledByStaffId: Number(session!.sub),
      handledAt: new Date(),
    })
    .where(eq(pickupRequests.id, pickup.id))
    .returning();

  return NextResponse.json({ pickup: updated });
}
