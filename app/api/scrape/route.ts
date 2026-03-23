import { NextRequest, NextResponse } from 'next/server';
import { searchGooglePlaces } from '@/lib/google-places';
import { parseQuery } from '@/lib/search';
import prisma from '@/lib/db';
import { RestaurantStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { city?: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { city, query } = body;

  if (!city || !query) {
    return NextResponse.json(
      { error: 'city and query are required' },
      { status: 400 }
    );
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return NextResponse.json(
      { error: 'RULE_05', message: 'Places API key is not configured' },
      { status: 503 }
    );
  }

  try {
    console.log(`[scrape] city=${city} query=${query}`);

    let created = 0;
    let skipped = 0;

    const terms = (await parseQuery(query)).terms;
    console.log(`[scrape] google-places terms=${terms}`);
    const results = await searchGooglePlaces(city, terms);
    console.log(`[scrape] google-places results=${results.length}`, results.map(p => p.name));

    for (const place of results) {
      const existing = await prisma.restaurant.findFirst({
        where: {
          name: { equals: place.name, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        },
      });
      if (existing) { skipped++; continue; }

      const restaurant = await prisma.restaurant.create({
        data: {
          name: place.name,
          city,
          address: place.address,
          phone: place.phone,
          website: place.website,
          hours: place.hours,
          price_range: place.price_range,
          service_options: place.service_options,
          photo_url: place.photo_url,
          status: RestaurantStatus.UNREVIEWED,
        },
      });
      await prisma.communityRecommendation.create({
        data: {
          restaurant_id: restaurant.id,
          source: 'google-places',
          post_url: `google-places://places/${restaurant.id}`,
          summary: query,
        },
      });
      created++;
    }

    return NextResponse.json({ success: true, created, skipped });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Scrape failed', details: String(error) },
      { status: 500 }
    );
  }
}
