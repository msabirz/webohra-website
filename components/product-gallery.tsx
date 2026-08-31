'use client';

import { useState } from 'react';
import { Package, FileText } from 'lucide-react';
import { categoryColor } from '@/lib/category-color';

/**
 * PDP/SDP image gallery — shows the seller's own uploaded photos (see
 * components/seller/image-manager.tsx) when there are any, main image +
 * thumbnail strip. Falls back to a styled color-block placeholder for
 * listings with no photos yet (older listings, or before R2 is configured).
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
    return (
      <div className="flex flex-col gap-3">
        <div className="h-72 overflow-hidden rounded-2xl bg-ivory-deep md:h-96">
          {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
          <img src={images[active].url} alt="" className="h-full w-full object-cover" />
        </div>
        {images.length > 1 && (
          <div className="flex gap-2.5">
            {images.map((img, i) => (
              <button
                key={img.id}
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
                className={`h-16 w-16 overflow-hidden rounded-xl transition-all ${
                  active === i
                    ? 'ring-2 ring-navy ring-offset-2'
                    : 'opacity-70 ring-1 ring-ink-soft/10 hover:opacity-100'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- seller-uploaded R2 URL, host not known at build time */}
                <img src={img.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  const base = categoryColor(categorySlug);
  const shades = [`${base}2e`, `${base}45`, `${base}1c`];
  const Icon = isService ? FileText : Package;

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex h-72 items-center justify-center rounded-2xl md:h-96"
        style={{ backgroundColor: shades[active] }}
      >
        <Icon className="h-20 w-20 text-ink/20" strokeWidth={1.25} />
      </div>
      <div className="flex gap-2.5">
        {shades.map((shade, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            aria-label={`View image ${i + 1}`}
            className={`flex h-16 w-16 items-center justify-center rounded-xl transition-all ${
              active === i
                ? 'ring-2 ring-navy ring-offset-2'
                : 'opacity-70 ring-1 ring-ink-soft/10 hover:opacity-100'
            }`}
            style={{ backgroundColor: shade }}
          >
            <Icon className="h-6 w-6 text-ink/25" strokeWidth={1.25} />
          </button>
        ))}
      </div>
    </div>
  );
}
