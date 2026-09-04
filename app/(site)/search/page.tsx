'use client';

import { Suspense } from 'react';
import { SearchResults } from '@/components/search-results';

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
