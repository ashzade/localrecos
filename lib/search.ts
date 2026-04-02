import prisma from '@/lib/db';
import { Prisma, RestaurantStatus } from '@prisma/client';
import { parseQueryWithLLM } from '@/lib/openrouter';
import { validateParsedQuery } from '@/lib/validate';
import { groupRestaurantsByName as _groupRestaurantsByName, type GroupableRestaurant } from '@/lib/restaurant-grouping';
export type { RestaurantLocation, RestaurantGroup } from '@/lib/restaurant-grouping';

export interface ParsedQuery {
  city: string | null;
  terms: string;
  raw: string;
}

/**
 * Parse a natural language query into city + search terms using an LLM via OpenRouter.
 * Falls back to regex if the API key is missing or the call fails.
 */
export async function parseQuery(query: string): Promise<ParsedQuery> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('RULE_01: Query text is required to begin restaurant search.');
  }
  const { city, terms } = await parseQueryWithLLM(trimmed);
  const result = { city, terms, raw: trimmed };
  validateParsedQuery(result);
  return result;
}

export interface RestaurantWithRecommendations {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  price_range: string | null;
  service_options: string[];
  status: RestaurantStatus;
  photo_url: string | null;
  upvotes: number;
  downvotes: number;
  created_at: Date;
  updated_at: Date;
  recommendations: Array<{
    id: string;
    restaurant_id: string;
    source: string;
    post_url: string;
    summary: string;
    mention_count: number;
    source_upvotes: number;
    upvotes: number;
    downvotes: number;
    scraped_at: Date;
  }>;
  total_net_votes: number;
}

export function groupRestaurantsByName(restaurants: RestaurantWithRecommendations[]): ReturnType<typeof _groupRestaurantsByName> {
  return _groupRestaurantsByName(restaurants as unknown as GroupableRestaurant[]);
}

/**
 * Find the restaurant group for a single restaurant by querying only candidates
 * with the same name prefix or shared website — avoids loading all city restaurants.
 */
export async function findRestaurantGroup(restaurantId: string, city: string, name: string) {
  const namePrefix = name.toLowerCase().trim().slice(0, 5);
  const candidates = await prisma.restaurant.findMany({
    where: {
      city: { equals: city, mode: 'insensitive' },
      name: { contains: namePrefix, mode: 'insensitive' },
    },
    include: { recommendations: { orderBy: [{ mention_count: 'desc' }, { scraped_at: 'desc' }] } },
  });
  const groups = _groupRestaurantsByName(
    candidates.map((r) => ({ ...r, total_net_votes: r.upvotes - r.downvotes }))
  );
  return groups.find((g) => g.locations.some((l) => l.id === restaurantId)) ?? null;
}

/**
 * Search for restaurants in a city matching the given terms.
 * Searches both restaurant name and recommendation summaries.
 */
const STOP_WORDS = new Set([
  'food', 'foods', 'restaurant', 'restaurants', 'place', 'places',
  'eat', 'eating', 'good', 'best', 'great', 'top', 'local', 'near',
  'nearby', 'spot', 'spots', 'recommend', 'recommendations',
]);

function parseWords(terms: string): string[] {
  return terms
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

export async function searchRestaurants(
  city: string,
  terms: string,
  limit = 10,
  offset = 0
): Promise<RestaurantWithRecommendations[]> {
  const normalizedCity = city.trim();
  const words = parseWords(terms);

  // Build a condition that matches any of the search words in the recommendation summary
  // or matches the restaurant name
  let whereCondition: Prisma.RestaurantWhereInput;

  if (words.length === 0) {
    whereCondition = {
      city: { equals: normalizedCity, mode: 'insensitive' },
    };
  } else {
    const summaryConditions: Prisma.CommunityRecommendationWhereInput[] = words.map((word) => ({
      summary: { contains: word, mode: 'insensitive' as Prisma.QueryMode },
    }));

    const nameConditions: Prisma.RestaurantWhereInput[] = words.map((word) => ({
      name: { contains: word, mode: 'insensitive' as Prisma.QueryMode },
    }));

    whereCondition = {
      city: { equals: normalizedCity, mode: 'insensitive' },
      OR: [
        ...nameConditions,
        {
          recommendations: {
            some: {
              OR: summaryConditions,
            },
          },
        },
      ],
    };
  }

  const restaurants = await prisma.restaurant.findMany({
    where: whereCondition,
    include: {
      recommendations: {
        orderBy: [
          { mention_count: 'desc' },
          { scraped_at: 'desc' },
        ],
      },
    },
    take: limit,
    skip: offset,
  });

  return restaurants
    .map((r) => {
      const totalNetVotes = r.upvotes - r.downvotes;
      return {
        ...r,
        total_net_votes: totalNetVotes,
      };
    })
    .sort((a, b) => b.total_net_votes - a.total_net_votes);
}

/**
 * Count restaurants in a city matching the search terms.
 */
export async function countSearchResults(city: string, terms: string): Promise<number> {
  const normalizedCity = city.trim();
  const words = parseWords(terms);

  if (words.length === 0) {
    return prisma.restaurant.count({
      where: { city: { equals: normalizedCity, mode: 'insensitive' } },
    });
  }

  const summaryConditions: Prisma.CommunityRecommendationWhereInput[] = words.map((word) => ({
    summary: { contains: word, mode: 'insensitive' as Prisma.QueryMode },
  }));

  const nameConditions: Prisma.RestaurantWhereInput[] = words.map((word) => ({
    name: { contains: word, mode: 'insensitive' as Prisma.QueryMode },
  }));

  return prisma.restaurant.count({
    where: {
      city: { equals: normalizedCity, mode: 'insensitive' },
      OR: [
        ...nameConditions,
        {
          recommendations: {
            some: {
              OR: summaryConditions,
            },
          },
        },
      ],
    },
  });
}
