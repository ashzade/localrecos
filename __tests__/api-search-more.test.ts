/**
 * Tests for app/api/search-more/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/search', () => ({
  searchRestaurants: vi.fn(),
}));

import { GET } from '@/app/api/search-more/route';
import { searchRestaurants } from '@/lib/search';

const mockSearchRestaurants = vi.mocked(searchRestaurants);

const fakeRestaurant = (n: number) => ({
  id: `r${n}`,
  name: `Restaurant ${n}`,
  city: 'Ottawa',
  address: null,
  phone: null,
  website: null,
  hours: null,
  price_range: null,
  photo_url: null,
  status: 'UNREVIEWED',
  upvotes: 0,
  downvotes: 0,
  total_net_votes: 0,
  recommendations: [],
});

function makeRequest(params: Record<string, string>): NextRequest {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/search-more?${qs}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/search-more', () => {
  it('returns 400 when city is missing', async () => {
    const res = await GET(makeRequest({ terms: 'sushi' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/city/i);
  });

  it('returns 400 when city is blank', async () => {
    const res = await GET(makeRequest({ city: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns results with hasMore: false when results fit within limit', async () => {
    mockSearchRestaurants.mockResolvedValue([fakeRestaurant(1), fakeRestaurant(2)] as never);
    const res = await GET(makeRequest({ city: 'Ottawa' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.hasMore).toBe(false);
  });

  it('returns hasMore: true and trims to limit when extra result exists', async () => {
    // default limit is 10; return 11 items → hasMore true, results grouped to 10
    const items = Array.from({ length: 11 }, (_, i) => fakeRestaurant(i));
    mockSearchRestaurants.mockResolvedValue(items as never);
    const res = await GET(makeRequest({ city: 'Ottawa' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    // 10 unique names → 10 groups
    expect(body.results).toHaveLength(10);
    expect(body.hasMore).toBe(true);
    expect(typeof body.nextOffset).toBe('number');
  });

  it('passes terms, offset, and limit to searchRestaurants', async () => {
    mockSearchRestaurants.mockResolvedValue([] as never);
    await GET(makeRequest({ city: 'Ottawa', terms: 'pizza', offset: '20', limit: '5' }));
    expect(mockSearchRestaurants).toHaveBeenCalledWith('Ottawa', 'pizza', 6, 20);
  });

  it('caps limit at 50', async () => {
    mockSearchRestaurants.mockResolvedValue([] as never);
    await GET(makeRequest({ city: 'Ottawa', limit: '999' }));
    // called with limit+1 = 51
    expect(mockSearchRestaurants).toHaveBeenCalledWith('Ottawa', '', 51, 0);
  });
});
