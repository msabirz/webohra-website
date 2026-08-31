import { NextResponse } from 'next/server';

/**
 * GET /api/geo/reverse?lat=&lng=
 *
 * Reverse-geocodes coordinates to a city name, server-side — kept off the
 * client both to control the required identifying User-Agent header (OSM
 * Nominatim's usage policy) and so the provider is swappable in one place
 * later (a paid geocoder, if Nominatim's free tier ever becomes unreliable
 * at real traffic) without touching every call site.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const lat = url.searchParams.get('lat');
  const lng = url.searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}&zoom=10`,
      {
        headers: {
          // Required by Nominatim's usage policy — identifies the app, not the caller.
          'User-Agent': 'WeBohraDev/1.0 (contact via project owner)',
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
    }

    const data = await res.json();
    const city: string | undefined =
      data.address?.city ?? data.address?.town ?? data.address?.village ?? data.address?.county;

    if (!city) {
      return NextResponse.json({ error: 'No city found for this location' }, { status: 404 });
    }

    return NextResponse.json({ city });
  } catch {
    return NextResponse.json({ error: 'Lookup failed' }, { status: 502 });
  }
}
