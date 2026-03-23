import prisma from '@/lib/db';
import { Prisma, RestaurantStatus } from '@prisma/client';
import { parseQueryWithLLM } from '@/lib/openrouter';

export interface ParsedQuery {
  city: string | null;
  terms: string;
  raw: string;
}

/**
 * Parse a natural language query into city + search terms using Gemini Flash.
 * Falls back to regex if the API key is missing or the call fails.
 */
export async function parseQuery(query: string): Promise<ParsedQuery> {
  const trimmed = query.trim();
  if (!trimmed) {
    throw new Error('RULE_01: Query text is required to begin restaurant search.');
  }
  const { city, terms } = await parseQueryWithLLM(trimmed);
  return { city, terms, raw: trimmed };
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

export interface RestaurantLocation {
  id: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  upvotes: number;
  downvotes: number;
}

export interface RestaurantGroup {
  id: string; // primary (highest-voted) location id
  name: string;
  city: string;
  price_range: string | null;
  photo_url: string | null;
  status: RestaurantStatus;
  upvotes: number;
  downvotes: number;
  total_net_votes: number;
  recommendations: RestaurantWithRecommendations['recommendations'];
  locations: RestaurantLocation[];
}

export function groupRestaurantsByName(restaurants: RestaurantWithRecommendations[]): RestaurantGroup[] {
  const map = new Map<string, RestaurantWithRecommendations[]>();
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    const group = map.get(key) ?? [];
    group.push(r);
    map.set(key, group);
  }

  return Array.from(map.values())
    .map((group) => {
      const sorted = [...group].sort((a, b) => b.total_net_votes - a.total_net_votes);
      const primary = sorted[0];

      const seenUrls = new Set<string>();
      const mergedRecs = sorted
        .flatMap((r) => r.recommendations)
        .filter((rec) => {
          if (seenUrls.has(rec.post_url)) return false;
          seenUrls.add(rec.post_url);
          return true;
        });

      return {
        id: primary.id,
        name: primary.name,
        city: primary.city,
        price_range: primary.price_range,
        photo_url: primary.photo_url,
        status: primary.status,
        upvotes: group.reduce((s, r) => s + r.upvotes, 0),
        downvotes: group.reduce((s, r) => s + r.downvotes, 0),
        total_net_votes: group.reduce((s, r) => s + r.total_net_votes, 0),
        recommendations: mergedRecs,
        locations: sorted.map((r) => ({
          id: r.id,
          address: r.address,
          phone: r.phone,
          website: r.website,
          hours: r.hours,
          upvotes: r.upvotes,
          downvotes: r.downvotes,
        })),
      };
    })
    .sort((a, b) => b.total_net_votes - a.total_net_votes);
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
