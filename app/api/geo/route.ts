import { NextRequest, NextResponse } from 'next/server';
import { detectCityFromIp, extractIp } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  // If coordinates provided, reverse geocode via Nominatim
  if (lat && lon) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
        { headers: { 'User-Agent': 'LocalRecos/1.0' }, next: { revalidate: 3600 } }
      );
      if (res.ok) {
        const data = await res.json();
        const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? null;
        if (city) return NextResponse.json({ city });
      }
    } catch {
      // fall through to IP
    }
  }

  // Fallback: IP geolocation
  const ip = extractIp(request.headers);
  const city = (await detectCityFromIp(ip)) ?? null;

  return NextResponse.json({ city });
}
