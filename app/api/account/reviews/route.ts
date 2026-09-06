import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { users } from '@/db/schema';
import { submitReviewSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { getEligibleOrderItemsForReview, getMyReviews, submitReview } from '@/lib/reviews';

/**
 * GET /api/account/reviews — backs the "My Reviews" section on /account:
 * delivered items she can still rate (`eligible`) plus reviews she's
 * already left (`submitted`, editable from here). Session-gated — there's
 * no guest-review path (see reviews.buyerId's own schema comment).
 */
export async function GET(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }
  const buyerId = Number(session.sub);
  const [eligible, submitted] = await Promise.all([
    getEligibleOrderItemsForReview(buyerId),
    getMyReviews(buyerId),
  ]);
  return NextResponse.json({ eligible, submitted });
}

/**
 * POST /api/account/reviews — submit a new review for a delivered order
 * item. buyerName is snapshotted from her account name at this instant,
 * never trusted from the request body (see reviews.buyerName's own schema
 * comment).
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = submitReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const buyerId = Number(session.sub);
  const [buyer] = await db.select({ name: users.name }).from(users).where(eq(users.id, buyerId));
  const buyerName = buyer?.name?.trim() || 'A WE Bohra buyer';

  const result = await submitReview(
    buyerId,
    buyerName,
    parsed.data.orderItemId,
    parsed.data.rating,
    parsed.data.comment || null,
  );
  if (!result.ok) {
    const status = result.error === 'Not found' ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ review: result.review }, { status: 201 });
}
