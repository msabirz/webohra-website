/**
 * Deterministic placeholder color per category, used on listing cards until
 * a real media pipeline (Cloudflare R2, per the SRS §4 `media` table) exists.
 * Curated for the known Phase-1 categories, with a stable hash fallback for
 * any future one so a new category never breaks the mapping.
 */
const CATEGORY_COLORS: Record<string, string> = {
  food: '#D9BE84',
  textile: '#1F5C55',
  'beauty-occasion': '#B08D3F',
  'art-craft': '#5C4C3F',
  'it-services': '#1B3A6B',
};

const FALLBACK_PALETTE = ['#1B3A6B', '#B08D3F', '#1F5C55', '#5C4C3F', '#D9BE84'];

export function categoryColor(categorySlug: string): string {
  if (CATEGORY_COLORS[categorySlug]) return CATEGORY_COLORS[categorySlug];
  let hash = 0;
  for (let i = 0; i < categorySlug.length; i++) {
    hash = (hash * 31 + categorySlug.charCodeAt(i)) >>> 0;
  }
  return FALLBACK_PALETTE[hash % FALLBACK_PALETTE.length];
}
