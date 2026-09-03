'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Package, FileText } from 'lucide-react';
import { categoryColor } from '@/lib/category-color';

/**
 * PDP/SDP image gallery — shows the seller's own uploaded photos (see
 * components/seller/image-manager.tsx) when there are any: a large hero
 * image with a vertical thumbnail rail beside it on desktop (md+), hover
 * arrows for click-through, and a dot-pagination overlay for mobile
 * (rail hidden there — narrow screens tap the dots or the arrows instead).
 * Falls back to a styled color-block placeholder for listings with no
 * photos yet (older listings, or before R2 is configured), same shape
 * either way so the parent's sticky wrapper (see the PDP page) doesn't
 * care which case it's in.
 *
 * Redesigned 2026-09-03 (product PDP UX refresh, user-approved mockup) —
 * previously a static hero with a horizontal thumbnail row underneath and
 * no click-through arrows.
 */
export function ProductGallery({
  categorySlug,
  isService,
  images = [],
}: {
  categorySlug: string;
  isService: boolean;
  images?: { id: number; url: string }[];
}) {
  const [active, setActive] = useState(0);

  if (images.length > 0) {
    const hasMultiple = images.length > 1;
    return (
      <div className="flex gap-3">
        {hasMultiple && (
          <div className="hidden shrink-0 flex-col gap-2.5 md:flex">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={`h-16 w-16 overflow-hidden rounded-xl transition-all ${
                  active === i
                    ? 'ring-2 ring-navy ring-offset-2'
                    : 'opacity-60 ring-1 ring-ink-soft/10 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
        <div className="relative flex-1 overflow-hidden rounded-2xl bg-ivory-deep">
          {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
          <img src={images[active].url} alt="" className="aspect-[4/5] w-full object-cover" />
          {hasMultiple && (
            <>
              <button
                onClick={() => setActive((a) => (a - 1 + images.length) % images.length)}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white"
              >
                <ChevronLeft className="h-4 w-4" strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setActive((a) => (a + 1) % images.length)}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition hover:bg-white"
              >
                <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
              </button>
              {/* Dots only stand in for the rail on narrow screens — md+
               *  already has the rail as the primary jump control. */}
              <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden">
                {images.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${
                      active === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const base = categoryColor(categorySlug);
  const shades = [`${base}2e`, `${base}45`, `${base}1c`];
  const Icon = isService ? FileText : Package;

  return (
    <div className="flex gap-3">
      <div className="hidden shrink-0 flex-col gap-2.5 md:flex">
        {shades.map((shade, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            className={`flex h-16 w-16 items-center justify-center rounded-xl transition-all ${
              active === i
                ? 'ring-2 ring-navy ring-offset-2'
                : 'opacity-60 ring-1 ring-ink-soft/10 hover:opacity-100'
            }`}
            style={{ backgroundColor: shade }}
          >
            <Icon className="h-6 w-6 text-ink/25" strokeWidth={1.25} />
          </button>
        ))}
      </div>
      <div
        className="flex aspect-[4/5] flex-1 items-center justify-center rounded-2xl"
        style={{ backgroundColor: shades[active] }}
      >
        <Icon className="h-20 w-20 text-ink/20" strokeWidth={1.25} />
      </div>
    </div>
  );
}
