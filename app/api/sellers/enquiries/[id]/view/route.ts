import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries } from '@/db/schema';
import { getSessionFromRequest } from '@/lib/auth';

/** PATCH /api/sellers/enquiries/[id]/view — marks a request 'viewed' the
 *  moment she opens it. Only actually moves 'initiated' -> 'viewed';
 *  re-opening an already-viewed/accepted/rejected one is a no-op. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { id } = await params;
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, Number(id)));
  if (!enquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (enquiry.sellerId !== Number(session.sub)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (enquiry.status !== 'initiated') {
    return NextResponse.json({ enquiry });
  }

  const [updated] = await db
    .update(enquiries)
    .set({ status: 'viewed', viewedAt: new Date() })
    .where(eq(enquiries.id, enquiry.id))
    .returning();

  return NextResponse.json({ enquiry: updated });
}
