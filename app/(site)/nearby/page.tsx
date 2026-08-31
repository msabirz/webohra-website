'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { ListingCard, type ListingCardData } from '@/components/listing-card';
import { ListingGridSkeleton } from '@/components/skeleton';
import { LocationPicker } from '@/components/location-picker';
import { getStoredLocation, type BuyerLocation } from '@/lib/location-client';
import { buttonStyles } from '@/lib/button-styles';

export default function NearbyPage() {
  const [location, setLocation] = useState<BuyerLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [listings, setListings] = useState<ListingCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Also re-reads if the header's own location picker changes it while
    // she's sitting on this page — same reactivity fix as the homepage.
    function syncLocation() {
      setLocation(getStoredLocation());
      setChecked(true);
    }
    syncLocation();
    window.addEventListener('wb:location-changed', syncLocation);
    return () => window.removeEventListener('wb:location-changed', syncLocation);
  }, []);

  useEffect(() => {
    if (!location) return;
    setLoading(true);
    fetch(`/api/listings?nearCity=${encodeURIComponent(location.city)}&sort=newest`)
      .then((res) => res.json())
      .then((data) => setListings(data.listings ?? []))
      .finally(() => setLoading(false));
  }, [location]);

  if (!checked) return null;

  if (!location) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ivory-deep">
          <MapPin className="h-6 w-6 text-ink-soft" strokeWidth={1.5} />
        </span>
        <p className="font-heading text-xl font-semibold text-ink">
          Set your location to see what&apos;s nearby
        </p>
        <button onClick={() => setPickerOpen(true)} className={buttonStyles('primary', 'md')}>
          Choose your location
        </button>
        {pickerOpen && (
          <LocationPicker onClose={() => setPickerOpen(false)} onSelect={setLocation} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 font-heading text-2xl font-semibold text-ink">
          <MapPin className="h-5 w-5 text-teal-deep" strokeWidth={2} />
          Buy Now at {location.city}
        </h1>
        <button
          onClick={() => setPickerOpen(true)}
          className="font-body text-sm font-medium text-navy transition hover:underline"
        >
          Change location
        </button>
      </div>

      <p className="rounded-xl bg-ivory-deep px-4 py-2.5 font-body text-xs text-ink-soft">
        Matches sellers whose Delhivery pickup point is in {location.city}. Sellers who ship
        entirely on their own don&apos;t register a city yet, so they won&apos;t appear here.
      </p>

      {loading ? (
        <ListingGridSkeleton />
      ) : listings.length === 0 ? (
        <p className="font-body text-sm text-ink-soft">
          Nothing near {location.city} yet — check back soon, or browse all collections.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      )}

      {pickerOpen && (
        <LocationPicker
          onClose={() => setPickerOpen(false)}
          onSelect={(loc) => {
            setLocation(loc);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
