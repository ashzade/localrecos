/**
 * Tests for app/api/vote/route.ts and app/api/restaurant-vote/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  default: {
    communityRecommendation: { findUnique: vi.fn(), update: vi.fn() },
    restaurant: { findUnique: vi.fn(), update: vi.fn() },
    vote: { create: vi.fn() },
    restaurantVote: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('@/lib/rules', () => ({
  checkRule03: vi.fn(),
  checkRule05: vi.fn(),
  tryTransitionToVerified: vi.fn(),
}));

vi.mock('@/lib/fingerprint', () => ({
  computeFingerprint: vi.fn().mockReturnValue('fp-test'),
}));

import { POST as votePost } from '@/app/api/vote/route';
import { POST as restaurantVotePost } from '@/app/api/restaurant-vote/route';
import prisma from '@/lib/db';
import { checkRule03, checkRule05 } from '@/lib/rules';

const mockFindUniqueRec = vi.mocked(prisma.communityRecommendation.findUnique);
const mockFindUniqueRes = vi.mocked(prisma.restaurant.findUnique);
const mockCheckRule03 = vi.mocked(checkRule03);
const mockCheckRule05 = vi.mocked(checkRule05);
const mockTransaction = vi.mocked(prisma.$transaction);

function makePost(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeRestaurantVotePost(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/restaurant-vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const fakeRecommendation = { id: 'rec1', restaurant_id: 'rest1', upvotes: 3, downvotes: 1 };
const fakeRestaurant = { id: 'rest1', name: 'Zen Kitchen', upvotes: 5, downvotes: 2 };
const updatedCounts = { upvotes: 4, downvotes: 1 };

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckRule03.mockResolvedValue(true);
  mockCheckRule05.mockResolvedValue(true);
  mockTransaction.mockImplementation(async (fn: (tx: typeof prisma) => Promise<unknown>) => fn(prisma));
  // Default: first lookup returns the entity, second (post-transaction) returns updated counts
  mockFindUniqueRec
    .mockResolvedValueOnce(fakeRecommendation as never)
    .mockResolvedValue({ ...fakeRecommendation, ...updatedCounts } as never);
  mockFindUniqueRes
    .mockResolvedValueOnce(fakeRestaurant as never)
    .mockResolvedValue({ ...fakeRestaurant, ...updatedCounts } as never);
});

// ── POST /api/vote ────────────────────────────────────────────────────────────

describe('POST /api/vote', () => {
  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/vote', {
      method: 'POST',
      body: 'not json',
    });
    const res = await votePost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when recommendation_id is missing', async () => {
    const res = await votePost(makePost({ direction: 'up' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when direction is missing', async () => {
    const res = await votePost(makePost({ recommendation_id: 'rec1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when direction is invalid', async () => {
    const res = await votePost(makePost({ recommendation_id: 'rec1', direction: 'sideways' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/up.*down|direction/i);
  });

  it('returns 404 when recommendation does not exist', async () => {
    mockFindUniqueRec.mockReset();
    mockFindUniqueRec.mockResolvedValue(null as never);
    const res = await votePost(makePost({ recommendation_id: 'bogus', direction: 'up' }));
    expect(res.status).toBe(404);
  });

  it('returns 409 with RULE_03 when user has already voted', async () => {
    mockCheckRule03.mockResolvedValue(false);
    const res = await votePost(makePost({ recommendation_id: 'rec1', direction: 'up' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('RULE_03');
  });

  it('returns 200 with updated vote counts on upvote', async () => {
    const res = await votePost(makePost({ recommendation_id: 'rec1', direction: 'up' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.upvotes).toBe('number');
    expect(typeof body.downvotes).toBe('number');
    expect(typeof body.net_votes).toBe('number');
  });

  it('returns 200 on downvote', async () => {
    const res = await votePost(makePost({ recommendation_id: 'rec1', direction: 'down' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ── POST /api/restaurant-vote ─────────────────────────────────────────────────

describe('POST /api/restaurant-vote', () => {
  it('returns 400 when body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/restaurant-vote', {
      method: 'POST',
      body: 'not json',
    });
    const res = await restaurantVotePost(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when restaurant_id is missing', async () => {
    const res = await restaurantVotePost(makeRestaurantVotePost({ direction: 'up' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when direction is missing', async () => {
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'rest1' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 when direction is invalid', async () => {
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'rest1', direction: 'left' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when restaurant does not exist', async () => {
    mockFindUniqueRes.mockReset();
    mockFindUniqueRes.mockResolvedValue(null as never);
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'bogus', direction: 'up' }));
    expect(res.status).toBe(404);
  });

  it('returns 409 with RULE_05 when user has already voted on the restaurant', async () => {
    mockCheckRule05.mockResolvedValue(false);
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'rest1', direction: 'up' }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toBe('RULE_05');
  });

  it('returns 200 with updated counts on upvote', async () => {
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'rest1', direction: 'up' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(typeof body.upvotes).toBe('number');
    expect(typeof body.net_votes).toBe('number');
  });

  it('returns 200 on downvote', async () => {
    const res = await restaurantVotePost(makeRestaurantVotePost({ restaurant_id: 'rest1', direction: 'down' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
