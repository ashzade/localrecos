import { NextRequest, NextResponse } from 'next/server';
import { searchGooglePlaces, PlaceDetails } from '@/lib/google-places';
import { parseQuery } from '@/lib/search';
import { getRedditRecommendations } from '@/lib/openrouter';
import { scrapeRedditForRestaurants, fetchCommunityPicksForRestaurant, ExtractedRestaurant } from '@/lib/reddit';
import prisma from '@/lib/db';
import { RestaurantStatus } from '@prisma/client';
import { validateRestaurantInput, validateCommunityRecommendationInput } from '@/lib/validate';
import { assertValidTransition, type ScrapeState } from '@/lib/state-machine';

export const dynamic = 'force-dynamic';

async function upsertRestaurant(city: string, name: string, placeData?: PlaceDetails) {
  const canonicalName = placeData?.name ?? name;

  // Check by canonical Google Places name OR address to avoid duplicates when
  // the same place is extracted under slightly different names from different comments
  const existing = await prisma.restaurant.findFirst({
    where: {
      OR: [
        { name: { equals: canonicalName, mode: 'insensitive' }, city: { equals: city, mode: 'insensitive' } },
        ...(placeData?.address ? [{ address: placeData.address }] : []),
      ],
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

  let { city, query } = body;

  // RULE_06: fall back to DEFAULT_CITY if caller omits city
  if (!city) {
    const defaultCity = process.env.DEFAULT_CITY;
    if (!defaultCity) {
      return NextResponse.json(
        { error: 'RULE_06', message: 'No city provided and DEFAULT_CITY environment variable is not set; cannot resolve location.' },
        { status: 400 }
      );
    }
    city = defaultCity;
  }

  if (!query) {
    return NextResponse.json(
      { error: 'RULE_01', message: 'Query text and city are required to begin restaurant search.' },
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
    let state: ScrapeState = 'PENDING';

    // PENDING → PARSING
    assertValidTransition(state, 'PARSING');
    state = 'PARSING';
    const terms = (await parseQuery(query)).terms;
    console.log(`[scrape] terms=${terms}`);

    // PARSING → FETCHING
    assertValidTransition(state, 'FETCHING');
    state = 'FETCHING';

    // Step 1: Fetch real Reddit posts for this city + query
    let redditResults: ExtractedRestaurant[] = await scrapeRedditForRestaurants(city, query);
    console.log(`[scrape] reddit posts=${redditResults.length}`, redditResults.map(r => r.name));

    // Step 2: Fall back to LLM if Reddit returned nothing
    if (redditResults.length === 0) {
      // FETCHING → FALLBACK
      assertValidTransition(state, 'FALLBACK');
      state = 'FALLBACK';
      console.log(`[scrape] no reddit results, falling back to LLM`);
      const llmRecs = await getRedditRecommendations(query, city, terms);
      if (llmRecs.length === 0) {
        assertValidTransition(state, 'FAILED');
        state = 'FAILED';
        return NextResponse.json({ success: true, created, skipped });
      }
      redditResults = llmRecs.map(r => ({
        name: r.name,
        postUrl: `reddit-llm://${encodeURIComponent(query)}`,
        summary: r.summary,
        source: 'reddit-llm',
        redditScore: 0,
      }));
    }

    // FETCHING/FALLBACK → EXTRACTING
    assertValidTransition(state, 'EXTRACTING');
    state = 'EXTRACTING';

    // Step 3: Enrich with Google Places in parallel
    // Include terms in the query so Google Places validates the place serves the right food type
    // EXTRACTING → VALIDATING
    assertValidTransition(state, 'VALIDATING');
    state = 'VALIDATING';
    const enriched = await Promise.all(
      redditResults.map(async (rec) => {
        const placeQuery = terms ? `${rec.name} ${terms}` : rec.name;
        const places = await searchGooglePlaces(city, placeQuery, 1);
        return { rec, place: places[0] as PlaceDetails | undefined };
      })
    );

    const confirmed = enriched.filter(({ place }) => place != null);
    if (confirmed.length === 0) {
      assertValidTransition(state, 'FAILED');
      state = 'FAILED';
      return NextResponse.json({ success: true, created, skipped });
    }

    // VALIDATING → ENRICHING
    assertValidTransition(state, 'ENRICHING');
    state = 'ENRICHING';

    // Step 4: Upsert restaurants and fetch community picks specifically about each restaurant
    // Skip any result Google Places couldn't confirm as a real food venue
    for (const { rec, place } of enriched) {
      if (!place) {
        console.log(`[scrape] skipping "${rec.name}" — not found in Google Places`);
        skipped++;
        continue;
      }

      validateRestaurantInput({
        name: place.name ?? rec.name,
        city,
        address: place.address ?? null,
        phone: place.phone ?? null,
        website: place.website ?? null,
        hours: place.hours ?? null,
        price_range: place.price_range ?? null,
        service_options: place.service_options ?? [],
        status: RestaurantStatus.UNREVIEWED,
        photo_url: place.photo_url ?? null,
        upvotes: 0,
        downvotes: 0,
      } as unknown as Record<string, unknown>);

      const { restaurant, wasCreated } = await upsertRestaurant(city, rec.name, place);
      if (wasCreated) created++; else skipped++;

      // Search Reddit specifically for this restaurant and store relevant posts/comments.
      // Use the original extracted name (rec.name) since that's what Reddit users write,
      // not the full Google Places canonical name which may include location suffixes.
      const picks = await fetchCommunityPicksForRestaurant(city, rec.name);
      console.log(`[scrape] community picks for "${rec.name}": ${picks.length}`);

      for (const pick of picks) {
        const existingRec = await prisma.communityRecommendation.findFirst({
          where: { restaurant_id: restaurant.id, post_url: pick.postUrl },
        });
        if (!existingRec) {
          validateCommunityRecommendationInput({
            restaurant_id: restaurant.id,
            source: pick.source,
            post_url: pick.postUrl,
            summary: pick.summary,
            mention_count: 1,
            source_upvotes: pick.redditScore,
            upvotes: 0,
            downvotes: 0,
          } as unknown as Record<string, unknown>);

          await prisma.communityRecommendation.create({
            data: {
              restaurant_id: restaurant.id,
              source: pick.source,
              post_url: pick.postUrl,
              summary: pick.summary,
              source_upvotes: pick.redditScore,
            },
          });
        }
      }
    }

    // ENRICHING → COMPLETE
    assertValidTransition(state, 'COMPLETE');
    state = 'COMPLETE';

    return NextResponse.json({ success: true, created, skipped });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Scrape failed', details: String(error) },
      { status: 500 }
    );
  }
}
