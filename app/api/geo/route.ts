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
      const nominatimStatus = res.status;
      const rawBody = await res.text();
      if (res.ok) {
        const data = JSON.parse(rawBody);
        const city = data.address?.city ?? data.address?.town ?? data.address?.village ?? null;
        return NextResponse.json({ city, debug: { source: 'nominatim', status: nominatimStatus, address: data.address } });
      }
      return NextResponse.json({ city: null, debug: { source: 'nominatim_failed', status: nominatimStatus, body: rawBody.slice(0, 200) } });
    } catch (e) {
      return NextResponse.json({ city: null, debug: { source: 'nominatim_error', error: String(e) } });
    }
  }

  // Fallback: IP geolocation
  const ip = extractIp(request.headers);
  const city = (await detectCityFromIp(ip)) ?? null;

  return NextResponse.json({ city, debug: { source: 'ip', ip } });
}
