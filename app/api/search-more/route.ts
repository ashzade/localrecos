import { NextRequest, NextResponse } from 'next/server';
import { searchRestaurants } from '@/lib/search';
import { groupRestaurantsByName, type GroupableRestaurant } from '@/lib/restaurant-grouping';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city')?.trim();
  const terms = searchParams.get('terms')?.trim() ?? '';
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0') || 0, 0);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10') || 10, 50);
  const seenNamesParam = searchParams.get('seenNames') ?? '';
  const excludeNames = new Set(seenNamesParam ? seenNamesParam.split(',').filter(Boolean) : []);

  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  // Fetch one extra to know if there are more raw rows
  const raw = await searchRestaurants(city, terms, limit + 1, offset);
  const hasMore = raw.length > limit;
  const page = raw.slice(0, limit);

  const results = groupRestaurantsByName(page as unknown as GroupableRestaurant[], excludeNames);

  return NextResponse.json({ results, hasMore, nextOffset: offset + page.length });
}
