import prisma from '@/lib/db';
import { Prisma, RestaurantStatus } from '@prisma/client';

export interface ParsedQuery {
  city: string | null;
  terms: string;
  raw: string;
}

/**
 * Parse a natural language query into city + search terms.
 * e.g. "most authentic Indian in Ottawa" → { city: "Ottawa", terms: "most authentic Indian" }
 */
export function parseQuery(query: string): ParsedQuery {
  const trimmed = query.trim();

  // Match "in <City>" or "near <City>" at the end or middle of the query
  const cityPattern = /\b(?:in|near)\s+([A-Z][a-zA-Z\s]+?)(?:\s*$|\s+(?:area|canada|usa|us|uk))/i;
  const match = trimmed.match(cityPattern);

  if (match) {
    const city = match[1].trim();
    // Remove the city portion from the query to get the search terms
    const terms = trimmed
      .replace(match[0], '')
      .trim()
      .replace(/\s+/g, ' ');
    return { city, terms: terms || trimmed, raw: trimmed };
  }

  return { city: null, terms: trimmed, raw: trimmed };
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

/**
 * Search for restaurants in a city matching the given terms.
 * Searches both restaurant name and recommendation summaries.
 */
export async function searchRestaurants(
  city: string,
  terms: string
): Promise<RestaurantWithRecommendations[]> {
  const normalizedCity = city.trim();
  const words = terms
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

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
    take: 30,
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
  const words = terms
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);

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
