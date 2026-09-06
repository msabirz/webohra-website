import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { supportTickets } from '@/db/schema';
import { adminSupportTicketUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [existing] = await db.select().from(supportTickets).where(eq(supportTickets.id, Number(id)));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminSupportTicketUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(supportTickets)
    .set({
      ...parsed.data,
      updatedAt: new Date(),
      ...(parsed.data.status === 'resolved' && { resolvedAt: new Date() }),
      ...(parsed.data.status && parsed.data.status !== 'resolved' && { resolvedAt: null }),
    })
    .where(eq(supportTickets.id, existing.id))
    .returning();

  return NextResponse.json({ ticket: updated });
}
