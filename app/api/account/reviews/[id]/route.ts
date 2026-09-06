import { NextResponse } from 'next/server';
import { editReviewSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { editReview } from '@/lib/reviews';

/**
 * PATCH /api/account/reviews/[id] — she revises her own review's rating
 * and/or comment. Ownership is checked inside lib/reviews.ts's
 * editReview, not just assumed from the route matching — a review id
 * that isn't hers 404s, same as it not existing at all.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in first' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = editReviewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const result = await editReview(Number(id), Number(session.sub), parsed.data.rating, parsed.data.comment || null);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }
  return NextResponse.json({ review: result.review });
}
