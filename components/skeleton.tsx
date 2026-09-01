export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-ink-soft/10 ${className}`} />;
}

/** Matches ListingCard's current photo-dominant shape (aspect-[4/5] image,
 *  seller name + title + price, then a compact button row) — keep this in
 *  sync whenever that card's proportions change, or the loading state lies
 *  about what's coming. */
export function ListingCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/10">
      <Skeleton className="aspect-[4/5] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3.5 w-1/2" />
        <Skeleton className="mt-1 h-5 w-1/3" />
        <div className="mt-auto flex flex-row gap-2 pt-2.5">
          <Skeleton className="h-9 flex-1 rounded-xl" />
          <Skeleton className="h-9 flex-1 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

/** `gridClassName` should match the real grid's column classes exactly —
 *  every listing grid (homepage, search, category, nearby) caps at 3
 *  columns now — otherwise the skeleton reflows differently than the
 *  content that replaces it. */
export function ListingGridSkeleton({
  count = 8,
  gridClassName = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3',
}: {
  count?: number;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches the PDP's gallery + buy-box layout. */
export function ListingDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-3 w-40" />
      <div className="grid gap-10 md:grid-cols-2">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-72 w-full rounded-2xl md:h-96" />
          <div className="flex gap-2.5">
            <Skeleton className="h-16 w-16 rounded-xl" />
            <Skeleton className="h-16 w-16 rounded-xl" />
            <Skeleton className="h-16 w-16 rounded-xl" />
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-7 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/4" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

/**
 * One list row — matches the standard card-row treatment used across every
 * seller/admin list page (sellers, products, enquiries, pickups, banners,
 * jamaats, staff): `rounded-2xl bg-white p-4 shadow-sm ring-1
 * ring-ink-soft/5`, a leading icon/thumbnail, two lines of text, and a
 * trailing badge or button.
 */
export function RowSkeleton({ withIcon = true }: { withIcon?: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
      {withIcon && <Skeleton className="h-11 w-11 shrink-0 rounded-lg" />}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Skeleton className="h-4 w-1/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-6 w-20 shrink-0 rounded-full" />
    </div>
  );
}

export function RowListSkeleton({ count = 3, withIcon = true }: { count?: number; withIcon?: boolean }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: count }).map((_, i) => (
        <RowSkeleton key={i} withIcon={withIcon} />
      ))}
    </div>
  );
}

/** Matches the `<table>` markup used by the admin/seller Orders pages. */
export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-ink-soft/5">
      <table className="w-full min-w-[600px] border-collapse">
        <thead>
          <tr className="border-b border-ink-soft/10">
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i} className="px-4 py-3">
                <Skeleton className="h-3 w-16" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r} className="border-b border-ink-soft/5 last:border-0">
              {Array.from({ length: columns }).map((_, c) => (
                <td key={c} className="px-4 py-3.5">
                  <Skeleton className="h-3.5 w-full max-w-[100px]" />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Matches the dashboard StatCard shape (icon circle, big number, label).
 *  `gridClassName` should match the real stat grid's column count. */
export function StatGridSkeleton({
  count = 4,
  gridClassName = 'grid grid-cols-2 gap-4 sm:grid-cols-4',
}: {
  count?: number;
  gridClassName?: string;
}) {
  return (
    <div className={gridClassName}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

/**
 * The seller/admin portal shell itself, shown while the auth gate resolves
 * (before we even know if there's a sidebar to render) — a dark sidebar
 * silhouette with nav-item bars, plus a neutral content-area placeholder,
 * so the very first paint of /seller/* or /admin/* looks like the portal
 * that's about to appear rather than a blank centered line of text.
 */
export function PortalShellSkeleton({ navItems = 5 }: { navItems?: number }) {
  return (
    <div className="flex min-h-screen bg-ivory">
      <aside className="hidden w-64 flex-col gap-1 border-r border-ink-soft/10 bg-navy px-3 py-5 md:flex">
        <div className="mb-4 flex items-center gap-1.5 px-3 py-2">
          <div className="h-5 w-5 animate-pulse rounded bg-white/15" />
          <div className="h-4 w-28 animate-pulse rounded bg-white/15" />
        </div>
        {Array.from({ length: navItems }).map((_, i) => (
          <div key={i} className="h-9 animate-pulse rounded-xl bg-white/5" />
        ))}
      </aside>
      <main className="flex-1 px-4 py-8 pt-20 md:ml-0 md:px-8 md:py-10 md:pt-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <Skeleton className="h-8 w-56" />
          <StatGridSkeleton count={4} />
          <RowListSkeleton count={3} />
        </div>
      </main>
    </div>
  );
}

/**
 * Matches app/(minimal)'s order confirmation / request tracking pages: a
 * hero block, a status-steps bar, and a couple of info cards beneath.
 */
export function TrackingPageSkeleton() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-6 py-10">
        <Skeleton className="h-16 w-16 rounded-full" />
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-3 w-36" />
      </div>
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-28 w-full rounded-2xl" />
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
