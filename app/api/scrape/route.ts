import { NextRequest, NextResponse } from 'next/server';
import { searchGooglePlaces, PlaceDetails } from '@/lib/google-places';
import { parseQuery } from '@/lib/search';
import { getRedditRecommendations } from '@/lib/openrouter';
import prisma from '@/lib/db';
import { RestaurantStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

async function upsertRestaurant(city: string, name: string, placeData?: PlaceDetails) {
  const existing = await prisma.restaurant.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      city: { equals: city, mode: 'insensitive' },
    },
  });
  if (existing) return { restaurant: existing, wasCreated: false };

  const restaurant = await prisma.restaurant.create({
    data: {
      name: placeData?.name ?? name,
      city,
      address: placeData?.address ?? null,
      phone: placeData?.phone ?? null,
      website: placeData?.website ?? null,
      hours: placeData?.hours ?? null,
      price_range: placeData?.price_range ?? null,
      service_options: placeData?.service_options ?? [],
      photo_url: placeData?.photo_url ?? null,
      status: RestaurantStatus.UNREVIEWED,
    },
  });
  return { restaurant, wasCreated: true };
}

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
    console.log(`[scrape] terms=${terms}`);

    // Reddit LLM drives which restaurants appear; Google Places enriches with location data
    const redditRecs = await getRedditRecommendations(query, city, terms);
    console.log(`[scrape] reddit-llm recs=${redditRecs.length}`, redditRecs.map(r => r.name));

    // Enrich all recommendations with Google Places in parallel
    const enriched = await Promise.all(
      redditRecs.map(async (rec) => {
        const places = await searchGooglePlaces(city, rec.name, 1);
        return { rec, place: places[0] as PlaceDetails | undefined };
      })
    );

    for (const { rec, place } of enriched) {
      const { restaurant, wasCreated } = await upsertRestaurant(city, rec.name, place);
      if (wasCreated) created++; else skipped++;

      // Add reddit-llm recommendation if not already present
      const existingRec = await prisma.communityRecommendation.findFirst({
        where: { restaurant_id: restaurant.id, source: 'reddit-llm' },
      });
      if (!existingRec) {
        await prisma.communityRecommendation.create({
          data: {
            restaurant_id: restaurant.id,
            source: 'reddit-llm',
            post_url: `reddit-llm://${encodeURIComponent(query)}`,
            summary: rec.summary,
          },
        });
      }
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
