'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MapPin, Handshake, ArrowRight } from 'lucide-react';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { BannerSlider } from '@/components/banner-slider';
import { categoryColor } from '@/lib/category-color';
import { categoryIcon } from '@/lib/category-icon';
import { getStoredLocation } from '@/lib/location-client';

type Category = { id: number; name: string; slug: string };

// Seller signup is deliberately not promoted here — see app/seller/page.tsx's
// note: it's shared directly by Idara's team, not discovered via the site.
const PROMO_TILES = [
  { icon: MapPin, title: 'Shop nearby', body: 'See collections close to you.', href: '/nearby' },
  { icon: Handshake, title: 'Pickup & Pay', body: 'Skip shipping, pay in person.', href: '/faq' },
];

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [nearby, setNearby] = useState<ListingCardData[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/categories').then((res) => res.json()),
      fetch('/api/listings?sort=newest&limit=12').then((res) => res.json()),
    ])
      .then(([categoriesData, listingsData]) => {
        setCategories(categoriesData.categories ?? []);
        setListings(listingsData.listings ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Re-reads on mount AND whenever the header's location picker fires
    // 'wb:location-changed' (see lib/location-client.ts's setStoredLocation)
    // — without this, "Buy Now at {city}" and the Near-you section would
    // only ever reflect whatever location was set on a previous page load.
    function syncLocation() {
      const location = getStoredLocation();
      setCity(location?.city ?? null);
      if (location) {
        fetch(`/api/listings?nearCity=${encodeURIComponent(location.city)}&limit=4`)
          .then((res) => res.json())
          .then((data) => setNearby(data.listings ?? []));
      } else {
        setNearby([]);
      }
    }

    syncLocation();
    window.addEventListener('wb:location-changed', syncLocation);
    return () => window.removeEventListener('wb:location-changed', syncLocation);
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <BannerSlider />

      <section>
        <SectionHeading title="New arrivals" />
        {loading ? (
          <ListingGridSkeleton count={6} gridClassName="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" />
        ) : listings.length === 0 ? (
          <p className="font-body text-sm text-ink-soft">No collections yet — check back soon.</p>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {city && nearby.length > 0 && (
        <section>
          <SectionHeading title={`Near ${city}`} linkHref="/nearby" linkLabel="See all" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {nearby.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl bg-ivory-deep px-6 py-10">
        <h2 className="mb-6 text-center font-heading text-xl font-semibold text-ink">
          Shop by category
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
          {categories.map((category) => {
            const Icon = categoryIcon(category.slug);
            return (
              <Link
                key={category.id}
                href={`/c/${category.slug}`}
                className="group flex flex-col items-center gap-3 rounded-2xl bg-white px-3 py-7 text-center shadow-sm ring-1 ring-ink-soft/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: `${categoryColor(category.slug)}2e` }}
                >
                  <Icon className="h-6 w-6 text-navy" strokeWidth={1.75} />
                </span>
                <span className="font-body text-sm font-medium text-ink">{category.name}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PROMO_TILES.map((tile) => (
          <Link
            key={tile.title}
            href={tile.href}
            className="group flex items-start gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-ink-soft/5 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-navy/5">
              <tile.icon className="h-5 w-5 text-navy" strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <p className="font-heading text-sm font-semibold text-ink">{tile.title}</p>
              <p className="mt-0.5 font-body text-xs text-ink-soft">{tile.body}</p>
            </div>
            <ArrowRight className="mt-2 h-4 w-4 shrink-0 text-ink-soft/40 transition group-hover:translate-x-1 group-hover:text-navy" />
          </Link>
        ))}
      </section>
    </div>
  );
}

function SectionHeading({
  title,
  linkHref,
  linkLabel,
}: {
  title: string;
  linkHref?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-heading text-lg font-semibold text-ink">{title}</h2>
      {linkHref && linkLabel && (
        <Link
          href={linkHref}
          className="flex items-center gap-1 font-body text-sm font-medium text-navy transition hover:gap-1.5"
        >
          {linkLabel}
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
