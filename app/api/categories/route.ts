import { NextResponse } from 'next/server';
import { asc, eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { categories, subcategories, subcategoryFields } from '@/db/schema';

/**
 * GET /api/categories
 *
 * Returns every *active* category with its active subcategories nested,
 * e.g. for populating the subcategory picker on the listing-creation form.
 * No auth required — this is public catalog data, same as browsing the
 * site. Admin's own /api/admin/categories returns inactive ones too, since
 * she needs to see them to reactivate.
 *
 * Each subcategory carries its own `fields` (FR-17's admin-configurable
 * schema) — bundled eagerly here rather than a separate per-subcategory
 * fetch, since the seller form already loads this whole tree once up
 * front and the total field count across every subcategory is small.
 */
export async function GET() {
  const [cats, subs, fields] = await Promise.all([
    db.select().from(categories).where(eq(categories.active, true)),
    db.select().from(subcategories).where(eq(subcategories.active, true)),
    // Archived fields are never offered on the listing form — they stay in
    // the DB (and any listing's already-collected value for one still
    // displays, see lib/listing-fields.ts's getListingFieldValues), they
    // just stop being something a seller can newly fill in.
    db.select().from(subcategoryFields).where(eq(subcategoryFields.active, true)).orderBy(asc(subcategoryFields.sortOrder)),
  ]);

  const result = cats.map((category) => ({
    ...category,
    subcategories: subs
      .filter((sub) => sub.categoryId === category.id)
      .map((sub) => ({
        ...sub,
        fields: fields.filter((f) => f.subcategoryId === sub.id),
      })),
  }));

  return NextResponse.json({ categories: result });
}
