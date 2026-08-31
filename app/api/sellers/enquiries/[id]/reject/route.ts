import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { enquiries } from '@/db/schema';
import { enquiryRejectSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/** POST /api/sellers/enquiries/[id]/reject — declines a request, with an
 *  optional reason (shown back to the buyer on her tracking page). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const body = await request.json().catch(() => ({}));
  const parsed = enquiryRejectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(enquiries)
    .set({ status: 'rejected', respondedAt: new Date(), rejectionReason: parsed.data.reason || null })
    .where(eq(enquiries.id, enquiry.id))
    .returning();

  return NextResponse.json({ enquiry: updated });
}
