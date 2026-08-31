import { UtensilsCrossed, Shirt, Sparkles, Laptop2, ShoppingBag, type LucideIcon } from 'lucide-react';

/** Icon per Phase-1 category, with a sensible fallback for any future one. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  food: UtensilsCrossed,
  textile: Shirt,
  'beauty-occasion': Sparkles,
  'it-services': Laptop2,
};

export function categoryIcon(categorySlug: string): LucideIcon {
  return CATEGORY_ICONS[categorySlug] ?? ShoppingBag;
}
