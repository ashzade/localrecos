/**
 * Tests for app/api/trending/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    restaurant: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/geo', () => ({
  detectCityFromIp: vi.fn(),
  extractIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

import { GET } from '@/app/api/trending/route';
import prisma from '@/lib/db';
import { detectCityFromIp } from '@/lib/geo';

const mockFindMany = vi.mocked(prisma.restaurant.findMany);
const mockDetectCity = vi.mocked(detectCityFromIp);

function makeRestaurant(id: string, upvotes: number, downvotes: number, recommendations = 2) {
  return {
    id,
    name: `Restaurant ${id}`,
    city: 'Ottawa',
    address: null,
    price_range: null,
    hours: null,
    status: 'UNREVIEWED',
    upvotes,
    downvotes,
    recommendations: Array.from({ length: recommendations }, (_, i) => ({ id: `rec${i}` })),
  };
}

function makeRequest(city?: string): NextRequest {
  const url = city
    ? `http://localhost/api/trending?city=${encodeURIComponent(city)}`
    : 'http://localhost/api/trending';
  return new NextRequest(url);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindMany.mockResolvedValue([] as never);
});

describe('GET /api/trending', () => {
  it('uses city from query param when provided', async () => {
    await GET(makeRequest('Toronto'));
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { city: { equals: 'Toronto', mode: 'insensitive' } } })
    );
  });

  it('falls back to IP geolocation when city is not in query', async () => {
    mockDetectCity.mockResolvedValue('Vancouver');
    await GET(makeRequest());
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { city: { equals: 'Vancouver', mode: 'insensitive' } } })
    );
  });

  it('falls back to Ottawa when IP geolocation returns null', async () => {
    mockDetectCity.mockResolvedValue(null);
    await GET(makeRequest());
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { city: { equals: 'Ottawa', mode: 'insensitive' } } })
    );
  });

  it('returns results ranked by net votes descending', async () => {
    mockFindMany.mockResolvedValue([
      makeRestaurant('low', 2, 1),   // net +1
      makeRestaurant('high', 10, 1), // net +9
      makeRestaurant('mid', 5, 2),   // net +3
    ] as never);
    const res = await GET(makeRequest('Ottawa'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results.map((r: { id: string }) => r.id)).toEqual(['high', 'mid', 'low']);
  });

  it('caps results at 10', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => makeRestaurant(`r${i}`, i, 0)) as never
    );
    const res = await GET(makeRequest('Ottawa'));
    const body = await res.json();
    expect(body.results).toHaveLength(10);
  });

  it('includes recommendation_count and total_net_votes in each result', async () => {
    mockFindMany.mockResolvedValue([makeRestaurant('r1', 7, 2)] as never);
    const res = await GET(makeRequest('Ottawa'));
    const body = await res.json();
    expect(body.results[0]).toMatchObject({
      id: 'r1',
      total_net_votes: 5,
      recommendation_count: 2,
    });
  });

  it('returns empty results for a city with no restaurants', async () => {
    mockFindMany.mockResolvedValue([] as never);
    const res = await GET(makeRequest('Nowhere'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toEqual([]);
  });
});
