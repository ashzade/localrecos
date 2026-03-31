import { NextRequest, NextResponse } from 'next/server';
import { searchGooglePlaces, PlaceDetails } from '@/lib/google-places';
import { parseQuery } from '@/lib/search';
import { getRedditRecommendations } from '@/lib/openrouter';
import { scrapeRedditForRestaurants, ExtractedRestaurant } from '@/lib/reddit';
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

    // Step 1: Fetch real Reddit posts for this city + query
    let redditResults: ExtractedRestaurant[] = await scrapeRedditForRestaurants(city, query);
    console.log(`[scrape] reddit posts=${redditResults.length}`, redditResults.map(r => r.name));

    // Step 2: Fall back to LLM if Reddit returned nothing
    if (redditResults.length === 0) {
      console.log(`[scrape] no reddit results, falling back to LLM`);
      const llmRecs = await getRedditRecommendations(query, city, terms);
      redditResults = llmRecs.map(r => ({
        name: r.name,
        postUrl: `reddit-llm://${encodeURIComponent(query)}`,
        summary: r.summary,
        source: 'reddit-llm',
        redditScore: 0,
      }));
    }

    // Step 3: Enrich with Google Places in parallel
    const enriched = await Promise.all(
      redditResults.map(async (rec) => {
        const places = await searchGooglePlaces(city, rec.name, 1);
        return { rec, place: places[0] as PlaceDetails | undefined };
      })
    );

    // Step 4: Upsert restaurants and store Reddit posts as community recommendations
    for (const { rec, place } of enriched) {
      const { restaurant, wasCreated } = await upsertRestaurant(city, rec.name, place);
      if (wasCreated) created++; else skipped++;

      // Store each Reddit post as a community recommendation (deduped by post_url)
      const existingRec = await prisma.communityRecommendation.findFirst({
        where: { restaurant_id: restaurant.id, post_url: rec.postUrl },
      });
      if (!existingRec) {
        await prisma.communityRecommendation.create({
          data: {
            restaurant_id: restaurant.id,
            source: rec.source,
            post_url: rec.postUrl,
            summary: rec.summary,
            source_upvotes: rec.redditScore,
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
