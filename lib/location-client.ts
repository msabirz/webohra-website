'use client';

/**
 * Buyer's chosen location, for the header display and FR-3's nearby-first
 * ranking (see /api/listings?nearCity=). Two ways in: browser geolocation
 * (reverse-geocoded to a city via /api/geo/reverse) or manual city pick —
 * both write the same shape here, and either can override the other at any
 * time. Lives only in this browser; never sent anywhere but our own API.
 */
export type BuyerLocation = { city: string; source: 'geolocation' | 'manual' };

const LOCATION_KEY = 'wb_location';

export function getStoredLocation(): BuyerLocation | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(LOCATION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BuyerLocation;
  } catch {
    return null;
  }
}

export function setStoredLocation(location: BuyerLocation): void {
  window.localStorage.setItem(LOCATION_KEY, JSON.stringify(location));
  window.dispatchEvent(new CustomEvent('wb:location-changed', { detail: location }));
}

/** Common Phase-1 cities for the manual picker — not admin-configurable
 *  master data like jamaats, just a UI convenience list. */
export const COMMON_CITIES = [
  'Mumbai',
  'Surat',
  'Pune',
  'Indore',
  'Ahmedabad',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Kolkata',
];

export type GeolocateResult =
  | { ok: true; city: string }
  | { ok: false; error: 'unsupported' | 'denied' | 'unavailable' | 'lookup_failed' };

/** Asks the browser for a coarse position, then reverse-geocodes it via our
 *  own /api/geo/reverse (never calls a third party directly from the client). */
export function geolocateCity(): Promise<GeolocateResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ ok: false, error: 'unsupported' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch(
            `/api/geo/reverse?lat=${position.coords.latitude}&lng=${position.coords.longitude}`,
          );
          if (!res.ok) {
            resolve({ ok: false, error: 'lookup_failed' });
            return;
          }
          const data = await res.json();
          if (!data.city) {
            resolve({ ok: false, error: 'lookup_failed' });
            return;
          }
          resolve({ ok: true, city: data.city });
        } catch {
          resolve({ ok: false, error: 'lookup_failed' });
        }
      },
      (err) => {
        resolve({ ok: false, error: err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable' });
      },
      { timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
