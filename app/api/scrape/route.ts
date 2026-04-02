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

/**
 * Fetch Reddit results for city+query, falling back to LLM if Reddit returns nothing.
 * Advances the state machine through PARSING → FETCHING → (FALLBACK?) → EXTRACTING.
 */
async function fetchWithFallback(
  city: string,
  query: string,
  state: ScrapeState,
  advance: (s: ScrapeState) => void,
): Promise<{ results: ExtractedRestaurant[]; state: ScrapeState; empty: boolean }> {
  advance('PARSING');
  const terms = (await parseQuery(query)).terms;

  advance('FETCHING');
  let results: ExtractedRestaurant[] = await scrapeRedditForRestaurants(city, query);

  if (results.length === 0) {
    advance('FALLBACK');
    const llmRecs = await getRedditRecommendations(query, city, terms);
    if (llmRecs.length === 0) {
      advance('FAILED');
      return { results: [], state: 'FAILED', empty: true };
    }
    results = llmRecs.map((r) => ({
      name: r.name,
      postUrl: `reddit-llm://${encodeURIComponent(query)}`,
      summary: r.summary,
      source: 'reddit-llm',
      redditScore: 0,
    }));
  }

  advance('EXTRACTING');
  return { results, state, empty: false };
}

/**
 * For each confirmed restaurant, upsert it and store any new community picks.
 * Returns { created, skipped } counts.
 */
async function enrichAndUpsert(
  confirmed: Array<{ rec: ExtractedRestaurant; place: PlaceDetails }>,
  city: string,
): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;
  for (const { rec, place } of confirmed) {
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
    });

    const { restaurant, wasCreated } = await upsertRestaurant(city, rec.name, place);
    if (wasCreated) created++; else skipped++;

    const picks = await fetchCommunityPicksForRestaurant(city, rec.name);
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
        });
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
  return { created, skipped };
}

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
  const internalToken = process.env.INTERNAL_API_TOKEN;
  if (internalToken && request.headers.get('x-internal-token') !== internalToken) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: { city?: string; q?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  let { city, q: query } = body;

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
    let state: ScrapeState = 'PENDING';
    const advance = (next: ScrapeState) => {
      assertValidTransition(state, next);
      state = next;
    };

    const { results: redditResults, empty } = await fetchWithFallback(city, query, state, advance);
    if (empty) return NextResponse.json({ success: true, created: 0, skipped: 0 });

    // Enrich with Google Places in parallel (EXTRACTING → VALIDATING)
    // Include terms in the query so Google Places validates the place serves the right food type
    const terms = (await parseQuery(query)).terms;
    advance('VALIDATING');
    const enriched = await Promise.all(
      redditResults.map(async (rec) => {
        const placeQuery = terms ? `${rec.name} ${terms}` : rec.name;
        const places = await searchGooglePlaces(city, placeQuery, 1);
        return { rec, place: places[0] as PlaceDetails | undefined };
      })
    );

    const confirmed = enriched.filter((e): e is { rec: ExtractedRestaurant; place: PlaceDetails } => e.place != null);
    if (confirmed.length === 0) {
      advance('FAILED');
      return NextResponse.json({ success: true, created: 0, skipped: enriched.length });
    }

    advance('ENRICHING');
    const { created, skipped } = await enrichAndUpsert(confirmed, city);

    advance('COMPLETE');
    return NextResponse.json({ success: true, created, skipped });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Scrape failed', details: String(error) },
      { status: 500 }
    );
  }
}
