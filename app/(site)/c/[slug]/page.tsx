'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { FilterSortBar, type SortValue } from '@/components/filter-sort-bar';

type Subcategory = { id: number; name: string; slug: string };
type Category = { id: number; name: string; slug: string; subcategories: Subcategory[] };

export default function CategoryPage() {
  const params = useParams<{ slug: string }>();
  const searchParams = useSearchParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategorySlug, setSubcategorySlug] = useState<string | null>(null);
  const [sort, setSort] = useState<SortValue>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const category = useMemo(
    () => categories.find((c) => c.slug === params.slug),
    [categories, params.slug],
  );

  useEffect(() => {
    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => setCategories(data.categories ?? []));
  }, []);

  // Resets the subcategory filter (but not sort/price) whenever the
  // category itself changes via the URL — except a direct deep link
  // already names one (the header's hover mega-menu, 2026-09-03, links
  // straight to /c/[slug]?subcategory=[sub] so a click there lands
  // pre-filtered instead of on the unfiltered category first).
  useEffect(() => {
    setSubcategorySlug(searchParams.get('subcategory'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- searchParams is a new object each render; re-running on params.slug (the real trigger) plus its own value is enough, and including the object itself risks an update loop
  }, [params.slug, searchParams.get('subcategory')]);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ category: params.slug, sort });
    if (subcategorySlug) query.set('subcategory', subcategorySlug);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    fetch(`/api/listings?${query}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, [params.slug, subcategorySlug, sort, minPrice, maxPrice]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold text-ink">
        {category?.name ?? params.slug}
      </h1>

      {category && category.subcategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSubcategorySlug('')}
            className={`rounded-full border px-4 py-1.5 font-body text-xs font-medium transition-all ${
              !subcategorySlug
                ? 'border-navy bg-navy text-ivory shadow-sm'
                : 'border-ink-soft/15 bg-white text-ink-soft shadow-sm hover:border-navy/40'
            }`}
          >
            All
          </button>
          {category.subcategories.map((sub) => (
            <button
              key={sub.id}
              onClick={() => setSubcategorySlug(sub.slug)}
              className={`rounded-full border px-4 py-1.5 font-body text-xs font-medium transition-all ${
                subcategorySlug === sub.slug
                  ? 'border-navy bg-navy text-ivory shadow-sm'
                  : 'border-ink-soft/15 bg-white text-ink-soft shadow-sm hover:border-navy/40'
              }`}
            >
              {sub.name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <ListingGridSkeleton />
      ) : listings.length === 0 ? (
        <p className="font-body text-sm text-ink-soft">No collections here yet.</p>
      ) : (
        <>
          {(listings.length > 1 || minPrice || maxPrice) && (
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
