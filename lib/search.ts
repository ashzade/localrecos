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

function normalizeWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    // fallback for URLs without a protocol
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

function buildGroup(group: RestaurantWithRecommendations[]): RestaurantGroup {
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
}

function shouldMergeGroups(a: RestaurantWithRecommendations[], b: RestaurantWithRecommendations[]): boolean {
  // Check shared website across any locations
  const websitesA = new Set(a.map((r) => normalizeWebsite(r.website)).filter(Boolean));
  for (const r of b) {
    const w = normalizeWebsite(r.website);
    if (w && websitesA.has(w)) return true;
  }

  // Check if one name is a word-boundary prefix of the other (min 5 chars)
  const nameA = a[0].name.toLowerCase().trim();
  const nameB = b[0].name.toLowerCase().trim();
  const shorter = nameA.length <= nameB.length ? nameA : nameB;
  const longer = nameA.length <= nameB.length ? nameB : nameA;
  if (shorter.length >= 5) {
    // longer starts with shorter and the next char is a non-word char (space, punctuation)
    if (longer.startsWith(shorter) && (longer.length === shorter.length || /\W/.test(longer[shorter.length]))) {
      return true;
    }
  }

  return false;
}

export function groupRestaurantsByName(restaurants: RestaurantWithRecommendations[]): RestaurantGroup[] {
  // First pass: exact name grouping
  const map = new Map<string, RestaurantWithRecommendations[]>();
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    const group = map.get(key) ?? [];
    group.push(r);
    map.set(key, group);
  }

  // Second pass: merge groups with shared website or prefix-name match
  let groups = Array.from(map.values());
  let merged = true;
  while (merged) {
    merged = false;
    const next: RestaurantWithRecommendations[][] = [];
    const used = new Set<number>();
    for (let i = 0; i < groups.length; i++) {
      if (used.has(i)) continue;
      let combined = groups[i];
      for (let j = i + 1; j < groups.length; j++) {
        if (used.has(j)) continue;
        if (shouldMergeGroups(combined, groups[j])) {
          combined = [...combined, ...groups[j]];
          used.add(j);
          merged = true;
        }
      }
      next.push(combined);
      used.add(i);
    }
    groups = next;
  }

  return groups
    .map(buildGroup)
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
