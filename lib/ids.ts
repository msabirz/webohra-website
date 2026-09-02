import { randomBytes } from 'crypto';

// Excludes visually-confusable characters (0/O, 1/I/L).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/**
 * Public listing identifier for URLs (see app/(site)/listing/[slug]) —
 * never the raw sequential id, so a listing's URL doesn't reveal how many
 * listings exist. Title-derived for readability, e.g.
 * "assorted-khari-biscuits-500g" with no suffix in the common case — a
 * random suffix is only appended when that plain slug is already taken by
 * another listing (titles do collide across sellers, e.g. "Bridal Mehndi"),
 * via slugify() + a caller-side uniqueness check, not unconditionally here.
 */
export function slugifyTitle(title: string): string {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 180);
  return base || 'listing';
}

/** Appended only when slugifyTitle()'s plain result collides with an existing slug. */
export function withUniqueSuffix(base: string): string {
  return `${base}-${randomCode(5).toLowerCase()}`;
}

/**
 * Human-readable, non-sequential order number — the public identifier for
 * order confirmation URLs and footer order tracking (never the raw db id,
 * which would reveal total order volume). Format: WB + YYMMDD + 5-char code.
 */
export function generateOrderNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `WB${yy}${mm}${dd}-${randomCode(5)}`;
}

/**
 * Same idea as generateOrderNumber, for a Take Consultation request — a
 * distinct "WR" prefix (WE Bohra Request) so the footer/tracking page can
 * tell at a glance which kind of identifier was entered, and route to
 * /order/[orderNumber] or /request/[requestNumber] accordingly.
 */
export function generateRequestNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `WR${yy}${mm}${dd}-${randomCode(5)}`;
}

/**
 * Same idea again, for Pickup & Pay — the one gap in this pattern the
 * Fulfillment & Subscriptions planning doc called out (orders and
 * consultation requests both already had a public tracking identifier,
 * Pickup & Pay never did). "WP" (WE Bohra Pickup) so the prefix alone
 * says which kind of tracking page a code belongs on.
 */
export function generatePickupTrackingNumber(): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `WP${yy}${mm}${dd}-${randomCode(5)}`;
}
