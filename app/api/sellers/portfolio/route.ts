import { NextResponse } from 'next/server';
import { asc, eq, max } from 'drizzle-orm';
import { db } from '@/db/index';
import { portfolioItems } from '@/db/schema';
import { portfolioItemSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';

/**
 * GET /api/sellers/portfolio — her own past-work showcase, in display
 * order. Fulfillment & Subscriptions redesign, Phase 6. Any seller can
 * build one (not gated to service-type sellers) — only the public-facing
 * side (GET /api/listings/[idOrSlug]) chooses to surface it exclusively on
 * a service listing's detail page, matching the phase's "service-page
 * redesign" scope.
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const items = await db
    .select()
    .from(portfolioItems)
    .where(eq(portfolioItems.sellerId, Number(session.sub)))
    .orderBy(asc(portfolioItems.sortOrder));

  return NextResponse.json({ items });
}

/** POST /api/sellers/portfolio — add a new item, appended to the end. */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = portfolioItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerId = Number(session.sub);
  const [{ maxSortOrder }] = await db
    .select({ maxSortOrder: max(portfolioItems.sortOrder) })
    .from(portfolioItems)
    .where(eq(portfolioItems.sellerId, sellerId));

  const [item] = await db
    .insert(portfolioItems)
    .values({
      sellerId,
      title: parsed.data.title,
      description: parsed.data.description || null,
      link: parsed.data.link || null,
      imageUrl: parsed.data.imageUrl || null,
      sortOrder: (maxSortOrder ?? -1) + 1,
    })
    .returning();

  return NextResponse.json({ item }, { status: 201 });
}
