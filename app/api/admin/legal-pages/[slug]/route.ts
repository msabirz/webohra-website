import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { legalPages } from '@/db/schema';
import { legalPageUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { slug } = await params;
  const [existing] = await db.select().from(legalPages).where(eq(legalPages.slug, slug));
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = legalPageUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [updated] = await db
    .update(legalPages)
    .set({ ...parsed.data, updatedByStaffId: Number(session!.sub), updatedAt: new Date() })
    .where(eq(legalPages.id, existing.id))
    .returning();

  return NextResponse.json({ page: updated });
}
