'use client';

import { useEffect, useState } from 'react';
import { MessageSquareText } from 'lucide-react';
import { StarRating } from '@/components/star-rating';

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  buyerName: string;
  createdAt: string;
  updatedAt: string | null;
};

/**
 * Reviews & Ratings (Tier 3, item 17, 2026-09-06) — the PDP/SDP review
 * list, shared between the product page (collection/[slug]) and
 * ServiceDetailView. Fetches its own data independently of the parent
 * listing fetch (GET /api/listings/[idOrSlug]/reviews) so a listing with
 * many reviews never bloats the main page load — see that route's own
 * comment.
 */
export function ReviewsSection({ listingId }: { listingId: number }) {
  const [data, setData] = useState<{ average: number | null; count: number; reviews: Review[] } | null>(null);

  useEffect(() => {
    fetch(`/api/listings/${listingId}/reviews`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setData);
  }, [listingId]);

  if (!data || data.count === 0) return null;

  return (
    <div className="flex flex-col gap-4 border-t border-ink-soft/10 pt-6">
      <div className="flex items-center gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-ink">
          <MessageSquareText className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
          Reviews
        </h2>
        <span className="flex items-center gap-1.5 rounded-full bg-gold/10 px-2.5 py-1">
          <StarRating rating={data.average ?? 0} className="text-gold" />
          <span className="font-body text-xs font-semibold text-ink">{data.average?.toFixed(1)}</span>
          <span className="font-body text-xs text-ink-soft">
            ({data.count} review{data.count === 1 ? '' : 's'})
          </span>
        </span>
      </div>
      <ul className="flex flex-col gap-3">
        {data.reviews.map((r) => (
          <li key={r.id} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink-soft/5">
            <div className="flex items-center justify-between gap-2">
              <StarRating rating={r.rating} className="text-gold" />
              <span className="font-body text-xs text-ink-soft">
                {new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {r.updatedAt && ' (edited)'}
              </span>
            </div>
            {r.comment && <p className="mt-1.5 font-body text-sm text-ink">{r.comment}</p>}
            <p className="mt-1.5 font-body text-xs font-medium text-ink-soft">{r.buyerName}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
