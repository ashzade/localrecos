import { NextRequest, NextResponse } from 'next/server';
import { searchRestaurants } from '@/lib/search';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city')?.trim();
  const terms = searchParams.get('terms')?.trim() ?? '';
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0') || 0, 0);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '10') || 10, 50);

  if (!city) {
    return NextResponse.json({ error: 'city is required' }, { status: 400 });
  }

  // Fetch one extra to know if there are more
  const raw = await searchRestaurants(city, terms, limit + 1, offset);
  const hasMore = raw.length > limit;
  const results = raw.slice(0, limit);

  return NextResponse.json({ results, hasMore });
}
