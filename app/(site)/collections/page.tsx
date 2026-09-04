import { Suspense } from 'react';
import { SearchResults } from '@/components/search-results';

/**
 * "Collections" — the header's "All" nav destination (2026-09-04, renamed
 * from a plain "All" chip that used to just link to /search). Same
 * browse/filter/sort experience as a query-less /search — no separate
 * page logic to keep in sync, just a distinct, SEO-friendlier URL and
 * page name for "browse everything" specifically, as opposed to /search's
 * job of handling a typed query.
 */
export default function CollectionsPage() {
  return (
    <Suspense fallback={null}>
      <SearchResults />
    </Suspense>
  );
}
