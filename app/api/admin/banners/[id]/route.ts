import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { banners } from '@/db/schema';
import { adminBannerUpdateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  const [banner] = await db.select().from(banners).where(eq(banners.id, Number(id)));
  if (!banner) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = adminBannerUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { subheading, ctaLabel, ctaHref, ...rest } = parsed.data;
  const [updated] = await db
    .update(banners)
    .set({
      ...rest,
      ...(subheading !== undefined ? { subheading: subheading || null } : {}),
      ...(ctaLabel !== undefined ? { ctaLabel: ctaLabel || null } : {}),
      ...(ctaHref !== undefined ? { ctaHref: ctaHref || null } : {}),
    })
    .where(eq(banners.id, banner.id))
    .returning();

  return NextResponse.json({ banner: updated });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;
  await db.delete(banners).where(eq(banners.id, Number(id)));
  return NextResponse.json({ ok: true });
}
