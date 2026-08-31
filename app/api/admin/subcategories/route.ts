import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { categories, subcategories } from '@/db/schema';
import { adminSubcategoryCreateSchema } from '@/lib/validation';
import { getSessionFromRequest, isAdmin } from '@/lib/auth';
import { slugifyTitle, withUniqueSuffix } from '@/lib/ids';

/** POST /api/admin/subcategories — FR-17/FR-18: a subcategory's listingType
 *  is what actually determines physical_product/local_service/remote_service
 *  for every listing under it (sellers never choose it directly). */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!isAdmin(session)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = adminSubcategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const [category] = await db.select().from(categories).where(eq(categories.id, parsed.data.categoryId));
  if (!category) {
    return NextResponse.json(
      { error: 'Select a valid category', issues: { categoryId: ['Select a valid category'] } },
      { status: 400 },
    );
  }

  const baseSlug = parsed.data.slug ?? slugifyTitle(parsed.data.name);
  const [existingSlug] = await db.select().from(subcategories).where(eq(subcategories.slug, baseSlug));
  const slug = existingSlug ? withUniqueSuffix(baseSlug) : baseSlug;

  const [subcategory] = await db
    .insert(subcategories)
    .values({
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      slug,
      listingType: parsed.data.listingType,
    })
    .returning();

  return NextResponse.json({ subcategory }, { status: 201 });
}
