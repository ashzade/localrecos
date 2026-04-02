import { NextRequest, NextResponse } from 'next/server';
import { parseQuery, searchRestaurants, groupRestaurantsByName } from '@/lib/search';
import { detectCityFromIp, extractIp } from '@/lib/geo';

export const dynamic = 'force-dynamic';

const JSON_HEADER = { 'Content-Type': 'application/json' };

function triggerScrape(origin: string, city: string, query: string): void {
  const headers: Record<string, string> = { ...JSON_HEADER };
  if (process.env.INTERNAL_API_TOKEN) {
    headers['x-internal-token'] = process.env.INTERNAL_API_TOKEN;
  }
  fetch(`${origin}/api/scrape`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ city, q: query }),
  }).catch(() => undefined);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.trim().length === 0) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }

  const parsed = await parseQuery(q);
  const ip = extractIp(request.headers);

  // RULE_04: reject if no city can be resolved
  const resolvedCity = parsed.city ?? await detectCityFromIp(ip);

  if (!resolvedCity) {
    return NextResponse.json(
      {
        error: 'RULE_04',
        message:
          "We couldn't detect your location. Please include your city in the search (e.g. 'best sushi in Ottawa') or confirm your city.",
        requiresCity: true,
      },
      { status: 422 }
    );
  }

  const city: string = resolvedCity;
  const terms = parsed.terms;
  const restaurants = await searchRestaurants(city, terms);
  const grouped = groupRestaurantsByName(restaurants);

  if (grouped.length < 3) {
    triggerScrape(request.nextUrl.origin, city, q);
  }

  return NextResponse.json({ city, terms, results: grouped, count: grouped.length });
}
