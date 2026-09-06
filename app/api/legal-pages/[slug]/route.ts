import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { legalPages } from '@/db/schema';

/**
 * GET /api/legal-pages/[slug] — public, no auth. Backs /privacy, /terms,
 * /shipping-returns (2026-09-06) — real admin-edited content instead of
 * hardcoded JSX.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [page] = await db.select().from(legalPages).where(eq(legalPages.slug, slug));
  if (!page) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ page });
}
