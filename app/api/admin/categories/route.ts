import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { categories, subcategories } from '@/db/schema';
import { adminCategoryCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isStaff, isAdmin } from '@/lib/auth';
import { slugifyTitle, withUniqueSuffix } from '@/lib/ids';

/**
 * /api/admin/categories — FR-12/FR-18: create categories and see them with
 * their subcategories, no code deploy needed. Includes inactive ones (the
 * public /api/categories only ever returns active) so Admin can reactivate.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isStaff(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const cats = await db.select().from(categories).orderBy(asc(categories.name));
  const subs = await db.select().from(subcategories).orderBy(asc(subcategories.name));

  return NextResponse.json({
    categories: cats.map((cat) => ({
      ...cat,
      subcategories: subs.filter((sub) => sub.categoryId === cat.id),
    })),
  });
}

export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const baseSlug = parsed.data.slug ?? slugifyTitle(parsed.data.name);
  const [existingSlug] = await db.select().from(categories).where(eq(categories.slug, baseSlug));
  const slug = existingSlug ? withUniqueSuffix(baseSlug) : baseSlug;

  const [category] = await db.insert(categories).values({ name: parsed.data.name, slug }).returning();
  return NextResponse.json({ category: { ...category, subcategories: [] } }, { status: 201 });
}
