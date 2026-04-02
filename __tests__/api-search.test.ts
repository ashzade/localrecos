/**
 * Tests for app/api/search/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/openrouter', () => ({
  parseQueryWithLLM: vi.fn().mockResolvedValue({ city: 'Ottawa', terms: 'sushi' }),
  getRedditRecommendations: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/lib/geo', () => ({
  detect_city: vi.fn(),
  extractIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

vi.mock('@/lib/search', () => ({
  parseQuery: vi.fn(),
  searchRestaurants: vi.fn(),
  groupRestaurantsByName: vi.fn(),
}));

// Silence the background scrape fetch
const mockFetch = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', mockFetch);

import { GET } from '@/app/api/search/route';
import { parseQuery, searchRestaurants, groupRestaurantsByName } from '@/lib/search';
import { detect_city } from '@/lib/geo';

const mockParseQuery = vi.mocked(parseQuery);
const mockSearchRestaurants = vi.mocked(searchRestaurants);
const mockGroupRestaurantsByName = vi.mocked(groupRestaurantsByName);
const mockDetectCity = vi.mocked(detect_city);

function makeRequest(q?: string): NextRequest {
  const url = q !== undefined
    ? `http://localhost/api/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/search';
  return new NextRequest(url);
}

const fakeRestaurant = { id: 'r1', name: 'Zen Kitchen', city: 'Ottawa', upvotes: 5, downvotes: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockParseQuery.mockResolvedValue({ city: 'Ottawa', terms: 'sushi', raw: 'sushi Ottawa' });
  mockSearchRestaurants.mockResolvedValue([fakeRestaurant, fakeRestaurant, fakeRestaurant] as never);
  mockGroupRestaurantsByName.mockReturnValue([fakeRestaurant, fakeRestaurant, fakeRestaurant] as never);
});

describe('GET /api/search', () => {
  it('returns 400 when q is missing', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/required/i);
  });

  it('returns 400 when q is empty string', async () => {
    const res = await GET(makeRequest(''));
    expect(res.status).toBe(400);
  });

  it('returns 400 when q is only whitespace', async () => {
    const res = await GET(makeRequest('   '));
    expect(res.status).toBe(400);
  });

  it('returns 422 with requiresCity when no city can be resolved', async () => {
    mockParseQuery.mockResolvedValue({ city: null, terms: 'sushi', raw: 'sushi' });
    mockDetectCity.mockResolvedValue(null);
    const res = await GET(makeRequest('sushi'));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe('RULE_04');
    expect(body.requiresCity).toBe(true);
  });

  it('falls back to IP geolocation when parseQuery returns no city', async () => {
    mockParseQuery.mockResolvedValue({ city: null, terms: 'sushi', raw: 'sushi' });
    mockDetectCity.mockResolvedValue('Toronto');
    const res = await GET(makeRequest('sushi'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.city).toBe('Toronto');
  });

  it('returns 200 with results on happy path', async () => {
    const res = await GET(makeRequest('sushi Ottawa'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.city).toBe('Ottawa');
    expect(body.terms).toBe('sushi');
    expect(body.results).toHaveLength(3);
    expect(body.count).toBe(3);
  });

  it('triggers background scrape when fewer than 3 results', async () => {
    mockGroupRestaurantsByName.mockReturnValue([fakeRestaurant] as never);
    await GET(makeRequest('sushi Ottawa'));
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/scrape'),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('does not trigger scrape when 3 or more results', async () => {
    await GET(makeRequest('sushi Ottawa'));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
