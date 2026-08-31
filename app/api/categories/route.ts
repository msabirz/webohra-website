import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { categories, subcategories } from '@/db/schema';

/**
 * GET /api/categories
 *
 * Returns every *active* category with its active subcategories nested,
 * e.g. for populating the subcategory picker on the listing-creation form.
 * No auth required — this is public catalog data, same as browsing the
 * site. Admin's own /api/admin/categories returns inactive ones too, since
 * she needs to see them to reactivate.
 */
export async function GET() {
  const [cats, subs] = await Promise.all([
    db.select().from(categories).where(eq(categories.active, true)),
    db.select().from(subcategories).where(eq(subcategories.active, true)),
  ]);

  const result = cats.map((category) => ({
    ...category,
    subcategories: subs.filter((sub) => sub.categoryId === category.id),
  }));

  return NextResponse.json({ categories: result });
}
