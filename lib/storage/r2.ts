import { randomUUID } from 'crypto';
import { S3Client, DeleteObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Product photo storage — Cloudflare R2, which speaks the S3 API, so the
 * official AWS SDK works against it unmodified once pointed at R2's
 * S3-compatible endpoint (see root CLAUDE.md's tech stack). Sellers never
 * touch this module directly: the browser uploads straight to R2 using a
 * short-lived presigned URL from /api/uploads/presign, and only the
 * resulting public URL ever reaches our API/DB — no image bytes pass
 * through our server.
 */

const REQUIRED_ENV = [
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET_NAME',
  'R2_PUBLIC_BASE_URL',
] as const;

function isConfigured(): boolean {
  return REQUIRED_ENV.every((key) => !!process.env[key]);
}

let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    // Without this, the SDK defaults to virtual-hosted-style URLs
    // (https://{bucket}.{account}.r2.cloudflarestorage.com/{key}), which R2
    // doesn't reliably resolve/sign for presigned URLs — path-style
    // (https://{account}.r2.cloudflarestorage.com/{bucket}/{key}) is what
    // Cloudflare's own docs use and what's actually reliable here.
    forcePathStyle: true,
  });
  return client;
}

const ALLOWED_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function isImageContentTypeAllowed(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType);
}

/**
 * Returns a presigned PUT URL good for one direct-from-browser upload, plus
 * the public URL it'll be reachable at afterward.
 *
 * Key shape: `{sellerId}-{seller-slug}/{product-slug}/{uuid}.{ext}` — human-
 * browsable from the R2 dashboard (you can actually find a seller's product
 * folder by eye), while the numeric sellerId prefix guarantees no collision
 * even if two businesses slugify to the same name. The caller (see
 * /api/uploads/presign) is responsible for verifying she actually owns
 * `productSlug`'s listing before calling this — this function just builds
 * the path, it doesn't check anything.
 *
 * Note: sellerSlug is computed fresh from her current business name at
 * upload time, so if she renames her business later, new uploads land under
 * a different-looking folder than old ones — cosmetic only, since
 * listing_images.url (not the folder path) is the actual source of truth
 * for which image belongs to which listing.
 */
export async function createUploadUrl(
  sellerId: number,
  sellerSlug: string,
  productSlug: string,
  contentType: string,
): Promise<{ uploadUrl: string; publicUrl: string; key: string }> {
  if (!isConfigured()) {
    throw new Error(
      'R2 is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, ' +
        'R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL in .env.local (see .env.example).',
    );
  }

  const extension = EXTENSION_BY_TYPE[contentType] ?? 'jpg';
  const key = `${sellerId}-${sellerSlug}/${productSlug}/${randomUUID()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(getClient(), command, { expiresIn: 300 });
  const publicUrl = `${process.env.R2_PUBLIC_BASE_URL!.replace(/\/$/, '')}/${key}`;

  return { uploadUrl, publicUrl, key };
}

/** Best-effort delete — a listing_images row is the source of truth, so a
 *  failure here just leaves an orphaned object in the bucket rather than
 *  blocking the actual removal the seller asked for. */
export async function deleteUploadedObject(key: string): Promise<void> {
  if (!isConfigured()) return;
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
  } catch (err) {
    console.error('R2 delete failed for key', key, err);
  }
}

/** Derives the R2 object key back out of a public URL we generated above —
 *  needed since listing_images only stores the URL, not the raw key. */
export function keyFromPublicUrl(url: string): string | null {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, '');
  if (!base || !url.startsWith(`${base}/`)) return null;
  return url.slice(base.length + 1);
}

export { isConfigured as isR2Configured };
