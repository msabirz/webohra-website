'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { FilterSortBar, type SortValue } from '@/components/filter-sort-bar';

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}

function SearchResults() {
  const searchParams = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const [sort, setSort] = useState<SortValue>('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const query = new URLSearchParams({ sort });
    if (q) query.set('q', q);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    fetch(`/api/listings?${query}`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, [q, sort, minPrice, maxPrice]);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold text-ink">
        {q ? `Results for “${q}”` : 'All collections'}
      </h1>

      {loading ? (
        <ListingGridSkeleton />
      ) : listings.length === 0 ? (
        <p className="font-body text-sm text-ink-soft">No collections match your search.</p>
      ) : (
        <>
          {/* Hidden only when there's nothing to sort/filter among and no
           *  filter is active — if a price filter narrows this down to one
           *  result, the bar stays so she can widen it back out. */}
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
