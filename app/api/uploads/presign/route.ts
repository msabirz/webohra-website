import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db/index';
import { sellerProfiles, listings } from '@/db/schema';
import { uploadPresignSchema } from '@/lib/validation';
import { getSessionFromRequest } from '@/lib/auth';
import { createUploadUrl } from '@/lib/storage/r2';
import { slugifyTitle } from '@/lib/ids';

/**
 * POST /api/uploads/presign
 *
 * Seller-only. Hands back a short-lived presigned R2 PUT URL so the
 * browser uploads the image bytes directly to storage — our server only
 * ever sees the resulting public URL, never the file itself. 'listing' is
 * the only purpose today — a product/variant/field photo, scoped to a
 * listing she actually owns, attached via /api/listings/[id]/images.
 * (A 'payout_qr' purpose existed briefly for Phase 5c's payout redesign —
 * dropped 2026-09-03 alongside the 'qr_image' payout method itself.)
 */
export async function POST(request: Request) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ error: 'Sign in as a seller' }, { status: 401 });
  }

  const sellerId = Number(session.sub);
  const [profile] = await db.select().from(sellerProfiles).where(eq(sellerProfiles.userId, sellerId));
  if (!profile) {
    return NextResponse.json({ error: 'Only sellers can upload photos' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = uploadPresignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input', issues: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const sellerSlug = slugifyTitle(profile.businessName);

  const [listing] = await db.select().from(listings).where(eq(listings.id, parsed.data.listingId!));
  if (!listing) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  if (listing.sellerId !== sellerId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { uploadUrl, publicUrl } = await createUploadUrl(
      sellerId,
      sellerSlug,
      listing.slug,
      parsed.data.contentType,
    );
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (err) {
    console.error('R2 presign failed:', err);
    return NextResponse.json(
      { error: 'Photo uploads are not configured yet — contact the Idara team.' },
      { status: 503 },
    );
  }
}
