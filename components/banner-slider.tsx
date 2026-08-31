'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Banner = {
  id: number;
  heading: string;
  subheading: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  colorHex: string;
};

/** Homepage hero slider — Admin-managed (see /api/banners), not seller-set. */
export function BannerSlider() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    fetch('/api/banners')
      .then((res) => res.json())
      .then((data) => setBanners(data.banners ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (banners.length < 2) return;
    const id = setInterval(() => setActive((i) => (i + 1) % banners.length), 5500);
    return () => clearInterval(id);
  }, [banners.length]);

  if (banners.length === 0) return null;

  const banner = banners[active];
  const go = (delta: number) => setActive((i) => (i + delta + banners.length) % banners.length);

  return (
    <div
      className="group relative flex h-60 flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl px-6 text-center shadow-lg transition-colors duration-500 md:h-80"
      style={{ backgroundColor: banner.colorHex }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 30% 20%, rgba(255,255,255,0.18), transparent 55%)',
        }}
      />
      <h2 className="font-heading text-2xl font-semibold text-ivory md:text-4xl">
        {banner.heading}
      </h2>
      {banner.subheading && (
        <p className="max-w-md font-body text-sm text-ivory/85 md:text-base">
          {banner.subheading}
        </p>
      )}
      {banner.ctaLabel && banner.ctaHref && (
        <Link
          href={banner.ctaHref}
          className="rounded-full bg-gold px-6 py-2.5 font-body text-sm font-semibold text-ink shadow-md transition hover:bg-gold-soft hover:shadow-lg"
        >
          {banner.ctaLabel}
        </Link>
      )}

      {banners.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Previous slide"
            className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-ivory opacity-0 backdrop-blur-sm transition hover:bg-white/25 group-hover:opacity-100"
          >
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Next slide"
            className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-ivory opacity-0 backdrop-blur-sm transition hover:bg-white/25 group-hover:opacity-100"
          >
            <ChevronRight className="h-5 w-5" strokeWidth={2} />
          </button>
          <div className="absolute bottom-4 flex gap-1.5">
            {banners.map((b, i) => (
              <button
                key={b.id}
                onClick={() => setActive(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === active ? 'w-6 bg-ivory' : 'w-1.5 bg-ivory/40'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
