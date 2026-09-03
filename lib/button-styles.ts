/**
 * Shared button visual language — pill-shaped, soft elevation, consistent
 * hover/active motion. One source of truth so buttons don't drift into
 * ad-hoc flat rectangles across the site. Returns a className string, so it
 * works on <button>, <Link>, and <a> alike.
 */
export type ButtonVariant = 'primary' | 'accent' | 'whatsapp' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-body font-semibold ' +
  'transition-all duration-150 ease-out active:scale-[0.97] ' +
  'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-navy text-ivory shadow-sm hover:bg-navy-deep hover:shadow-md focus-visible:ring-navy',
  accent: 'bg-gold text-ink shadow-sm hover:bg-gold-soft hover:shadow-md focus-visible:ring-gold',
  whatsapp: 'bg-teal text-ivory shadow-sm hover:bg-teal-deep hover:shadow-md focus-visible:ring-teal',
  secondary:
    'bg-white text-ink border border-ink-soft/15 shadow-sm hover:border-navy/30 hover:bg-ivory-deep focus-visible:ring-navy',
  outline:
    'bg-white/10 text-ivory border border-ivory/25 backdrop-blur-sm hover:bg-white/20 focus-visible:ring-ivory',
  ghost: 'bg-transparent text-ink-soft hover:bg-ivory-deep hover:text-ink focus-visible:ring-navy',
};

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3.5 py-1.5 text-xs',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export function buttonStyles(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  extra = '',
): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`.trim();
}

/** Round icon-only button (cart, avatar, close, etc.) — same elevation language. */
export function iconButtonStyles(variant: ButtonVariant = 'secondary', extra = ''): string {
  return `${BASE} ${VARIANTS[variant]} h-10 w-10 !rounded-full !px-0 !py-0 ${extra}`.trim();
}

/**
 * The chunky rectangle + elevated drop shadow used where a product-tile
 * action sits side-by-side with another (Add to Cart / Buy on WhatsApp /
 * Take Consultation on ListingCard) instead of the default full pill —
 * shape only, same VARIANTS colors. One constant so all three call sites
 * (add-to-cart-button.tsx, whatsapp-buy-button.tsx,
 * consultation-request-button.tsx) move together (2026-09-03 restyle).
 *
 * A fixed pixel radius, not a `rounded-*` size token — these buttons run
 * 'sm' (~30px tall), where rounded-2xl's 16px is already half the height
 * and renders as a full stadium/pill, not a rectangle (caught 2026-09-03:
 * looked identical to the default pill shape it was meant to replace).
 * 10px stays visibly a rounded corner at this height. Padding bumped over
 * the base 'sm' size for a chunkier block closer to the reference shape.
 */
export const BOX_SHAPE_CLASS =
  '!rounded-[10px] !gap-1 !px-3 !py-2.5 !shadow-lg hover:!shadow-xl';

/** Shared text input treatment — rounded, soft focus ring, used by every form on the site. */
export const inputStyles =
  'rounded-xl border border-ink-soft/20 px-3.5 py-2.5 font-body text-sm text-ink ' +
  'transition focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15';
