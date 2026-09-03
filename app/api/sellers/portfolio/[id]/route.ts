import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { portfolioItems } from '@/db/schema';
import { portfolioItemSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { deleteUploadedObject, keyFromPublicUrl } from '@/lib/storage/r2';

/** PATCH /api/sellers/portfolio/[id] — owner-only, full replace of the
 *  editable fields (same shape as create, not a partial patch — matches
 *  how the form that calls this always sends every field). */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { id } = await params;
  const sellerId = Number(session.sub);

  const [existing] = await db
    .select()
    .from(portfolioItems)
    .where(and(eq(portfolioItems.id, Number(id)), eq(portfolioItems.sellerId, sellerId)));
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = portfolioItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // A replaced/removed photo's old object is now unreferenced — same
  // best-effort cleanup as removing a listing photo outright.
  const newImageUrl = parsed.data.imageUrl || null;
  if (existing.imageUrl && existing.imageUrl !== newImageUrl) {
    const key = keyFromPublicUrl(existing.imageUrl);
    if (key) await deleteUploadedObject(key);
  }

  const [item] = await db
    .update(portfolioItems)
    .set({
      title: parsed.data.title,
      description: parsed.data.description || null,
      link: parsed.data.link || null,
      imageUrl: newImageUrl,
    })
    .where(eq(portfolioItems.id, existing.id))
    .returning();

  return NextResponse.json({ item });
}

/** DELETE /api/sellers/portfolio/[id] — owner-only. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const { id } = await params;
  const sellerId = Number(session.sub);

  const [existing] = await db
    .select()
    .from(portfolioItems)
    .where(and(eq(portfolioItems.id, Number(id)), eq(portfolioItems.sellerId, sellerId)));
  if (!existing) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await db.delete(portfolioItems).where(eq(portfolioItems.id, existing.id));

  if (existing.imageUrl) {
    const key = keyFromPublicUrl(existing.imageUrl);
    if (key) await deleteUploadedObject(key);
  }

  return NextResponse.json({ ok: true });
}
