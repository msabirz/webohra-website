'use client';

import { Star } from 'lucide-react';

/**
 * Reviews & Ratings (Tier 3, item 17, 2026-09-06). Two variants sharing
 * one visual language: a read-only display (listing cards, PDP/SDP
 * header, each review in the list) and an interactive 1-5 picker (the
 * submission/edit form on /account). Rounds a fractional average to the
 * nearest whole star for display — good enough at this scale; a half-star
 * renderer isn't worth the extra complexity for a first version.
 */
export function StarRating({
  rating,
  size = 'sm',
  className = '',
}: {
  rating: number;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const rounded = Math.round(rating);
  const dim = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={dim}
          strokeWidth={1.75}
          fill={n <= rounded ? 'currentColor' : 'none'}
          stroke="currentColor"
        />
      ))}
    </span>
  );
}

export function StarRatingInput({
  value,
  onChange,
  size = 'md',
}: {
  value: number;
  onChange: (value: number) => void;
  size?: 'sm' | 'md';
}) {
  const dim = size === 'sm' ? 'h-5 w-5' : 'h-7 w-7';
  return (
    <span className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="text-gold transition hover:scale-110"
        >
          <Star className={dim} strokeWidth={1.75} fill={n <= value ? 'currentColor' : 'none'} stroke="currentColor" />
        </button>
      ))}
    </span>
  );
}
