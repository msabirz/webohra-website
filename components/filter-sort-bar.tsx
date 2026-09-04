'use client';

import { useState, type FormEvent } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { buttonStyles, inputStyles } from '@/lib/button-styles';

export type SortValue = 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
];

export type FilterCategory = { id: number; name: string; slug: string };

/**
 * Standard e-commerce sort + price-range filter, shared by /search
 * (also aliased at /collections) and /category/[slug] — only meaningful,
 * per the requester's own scoping, once there's more than one result to
 * sort/filter among; the caller decides whether to render this at all.
 *
 * The category dropdown (2026-09-04) is optional — only /search passes
 * `categories`, since a buyer already on one category's own page doesn't
 * need a redundant "which category" control repeating the page she's on.
 */
export function FilterSortBar({
  sort,
  onSortChange,
  minPrice,
  maxPrice,
  onPriceChange,
  resultCount,
  categories,
  selectedCategorySlug,
  onCategoryChange,
}: {
  sort: SortValue;
  onSortChange: (sort: SortValue) => void;
  minPrice: string;
  maxPrice: string;
  onPriceChange: (min: string, max: string) => void;
  resultCount: number;
  categories?: FilterCategory[];
  selectedCategorySlug?: string;
  onCategoryChange?: (slug: string) => void;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minDraft, setMinDraft] = useState(minPrice);
  const [maxDraft, setMaxDraft] = useState(maxPrice);
  const hasActiveFilter = !!minPrice || !!maxPrice;

  function applyPrice(event: FormEvent) {
    event.preventDefault();
    onPriceChange(minDraft.trim(), maxDraft.trim());
    setFiltersOpen(false);
  }

  function clearPrice() {
    setMinDraft('');
    setMaxDraft('');
    onPriceChange('', '');
    setFiltersOpen(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-body text-sm text-ink-soft">
          {resultCount} result{resultCount === 1 ? '' : 's'}
        </p>
        {/* flex-wrap (2026-09-04, real bug) — with the category select
         *  added alongside price + sort, three controls in one rigid row
         *  no longer fit a narrow phone width and pushed the whole page
         *  into horizontal scroll instead of wrapping to a second line. */}
        <div className="flex flex-wrap items-center gap-2">
          {categories && categories.length > 0 && (
            <select
              value={selectedCategorySlug || ''}
              onChange={(e) => onCategoryChange?.(e.target.value)}
              className="rounded-full border border-ink-soft/15 bg-white px-4 py-2 font-body text-sm text-ink shadow-sm transition hover:border-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/15"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <div className="relative">
            <button
              onClick={() => setFiltersOpen((v) => !v)}
              className={buttonStyles(hasActiveFilter ? 'primary' : 'secondary', 'sm')}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
              Price{hasActiveFilter ? ` · ₹${minPrice || '0'}–${maxPrice || '∞'}` : ''}
            </button>
            {filtersOpen && (
              <form
                onSubmit={applyPrice}
                className="absolute right-0 top-full z-20 mt-2 flex w-64 flex-col gap-3 rounded-2xl bg-white p-4 shadow-lg ring-1 ring-ink-soft/10"
              >
                <div className="flex items-center justify-between">
                  <p className="font-heading text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Price range
                  </p>
                  <button type="button" onClick={() => setFiltersOpen(false)} aria-label="Close" className="text-ink-soft hover:text-ink">
                    <X className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={minDraft}
                    onChange={(e) => setMinDraft(e.target.value)}
                    placeholder="Min ₹"
                    className={`${inputStyles} w-full`}
                  />
                  <span className="text-ink-soft">–</span>
                  <input
                    type="number"
                    min="0"
                    value={maxDraft}
                    onChange={(e) => setMaxDraft(e.target.value)}
                    placeholder="Max ₹"
                    className={`${inputStyles} w-full`}
                  />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className={buttonStyles('primary', 'sm', 'flex-1')}>
                    Apply
                  </button>
                  {hasActiveFilter && (
                    <button type="button" onClick={clearPrice} className={buttonStyles('ghost', 'sm')}>
                      Clear
                    </button>
                  )}
                </div>
              </form>
            )}
          </div>

          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortValue)}
            className="rounded-full border border-ink-soft/15 bg-white px-4 py-2 font-body text-sm text-ink shadow-sm transition hover:border-navy/30 focus:outline-none focus:ring-2 focus:ring-navy/15"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
