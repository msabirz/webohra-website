'use client';

import { useState } from 'react';
import { X, LocateFixed, MapPin } from 'lucide-react';
import {
  COMMON_CITIES,
  geolocateCity,
  setStoredLocation,
  type BuyerLocation,
} from '@/lib/location-client';
import { buttonStyles } from '@/lib/button-styles';

const GEOLOCATION_ERROR_MESSAGE: Record<string, string> = {
  unsupported: "Your browser doesn't support location detection — pick a city below.",
  denied: 'Location access was denied — pick a city below.',
  unavailable: "Couldn't determine your location — pick a city below.",
  lookup_failed: "Found your position but couldn't match it to a city — pick one below.",
};

export function LocationPicker({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (location: BuyerLocation) => void;
}) {
  const [detecting, setDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useMyLocation() {
    setDetecting(true);
    setError(null);
    const result = await geolocateCity();
    setDetecting(false);
    if (result.ok) {
      const location: BuyerLocation = { city: result.city, source: 'geolocation' };
      setStoredLocation(location);
      onSelect(location);
    } else {
      setError(GEOLOCATION_ERROR_MESSAGE[result.error]);
    }
  }

  function pickCity(city: string) {
    const location: BuyerLocation = { city, source: 'manual' };
    setStoredLocation(location);
    onSelect(location);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-ink/50 p-4 pt-24 backdrop-blur-sm">
      <button aria-hidden="true" tabIndex={-1} onClick={onClose} className="absolute inset-0" />
      <div className="relative flex w-full max-w-sm flex-col gap-5 rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-heading text-lg font-semibold text-ink">Choose your location</h2>
            <p className="mt-0.5 font-body text-xs text-ink-soft">
              For pickup options and collections near you.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-ink-soft transition hover:bg-ivory-deep hover:text-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <button
          onClick={useMyLocation}
          disabled={detecting}
          className={buttonStyles('primary', 'md', 'w-full')}
        >
          <LocateFixed className="h-4 w-4" strokeWidth={2} />
          {detecting ? 'Detecting…' : 'Use my current location'}
        </button>
        {error && <p className="font-body text-xs text-red-700">{error}</p>}

        <div className="flex items-center gap-3 font-body text-[11px] uppercase tracking-wide text-ink-soft">
          <span className="h-px flex-1 bg-ink-soft/15" /> or pick a city{' '}
          <span className="h-px flex-1 bg-ink-soft/15" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {COMMON_CITIES.map((city) => (
            <button
              key={city}
              onClick={() => pickCity(city)}
              className="flex items-center gap-2 rounded-xl border border-ink-soft/15 px-3 py-2.5 font-body text-sm text-ink transition hover:border-navy/40 hover:bg-ivory-deep"
            >
              <MapPin className="h-3.5 w-3.5 text-ink-soft" strokeWidth={2} />
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
