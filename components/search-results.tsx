'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { FilterSortBar, type SortValue, type FilterCategory } from '@/components/filter-sort-bar';

/**
 * The shared "browse/search everything" experience — used by both
 * app/(site)/search/page.tsx (a typed query, `?q=`) and
 * app/(site)/collections/page.tsx (no query, just "All Collections";
 * 2026-09-04, the header's "All" nav destination renamed for a
 * cleaner URL/label). Pulled into its own file rather than exported
 * from search/page.tsx directly — Next.js's page-shape checking
 * rejects a page module with extra named exports.
 */
export function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [sort, setSort] = useState<SortValue>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [categorySlug, setCategorySlug] = useState('');
  const [categories, setCategories] = useState<FilterCategory[]>([]);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ sort });
    if (q) query.set('q', q);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (categorySlug) query.set('category', categorySlug);
    fetch(`/api/listings?${query}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, [q, sort, minPrice, maxPrice, categorySlug]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold text-ink">
        {q ? `Results for “${q}”` : 'All Collections'}
      </h1>

      {loading ? (
        <ListingGridSkeleton />
      ) : listings.length === 0 ? (
        <p className="font-body text-sm text-ink-soft">No collections match your search.</p>
      ) : (
        <>
          {/* Hidden only when there's nothing to sort/filter among and no
           *  filter is active — if a price/category filter narrows this
           *  down to one result, the bar stays so she can widen it back
           *  out. */}
          {(listings.length > 1 || minPrice || maxPrice || categorySlug) && (
            <FilterSortBar
              sort={sort}
              onSortChange={setSort}
              minPrice={minPrice}
              maxPrice={maxPrice}
              onPriceChange={(min, max) => {
                setMinPrice(min);
                setMaxPrice(max);
              }}
              resultCount={listings.length}
              categories={categories}
              selectedCategorySlug={categorySlug}
              onCategoryChange={setCategorySlug}
            />
          )}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
