/**
 * Tests for lib/rules.ts — checkRule01, checkRule03, checkRule05, tryTransitionToVerified
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  default: {
    communityRecommendation: { count: vi.fn() },
    vote: { findFirst: vi.fn() },
    restaurantVote: { findFirst: vi.fn() },
    restaurant: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

import { checkRule01, checkRule03, checkRule05, tryTransitionToVerified } from '@/lib/rules';
import prisma from '@/lib/db';

const mockCount = vi.mocked(prisma.communityRecommendation.count);
const mockVoteFindFirst = vi.mocked(prisma.vote.findFirst);
const mockRestaurantVoteFindFirst = vi.mocked(prisma.restaurantVote.findFirst);
const mockRestaurantFindUnique = vi.mocked(prisma.restaurant.findUnique);
const mockRestaurantUpdate = vi.mocked(prisma.restaurant.update);

beforeEach(() => {
  vi.clearAllMocks();
});

// ── checkRule01 ───────────────────────────────────────────────────────────────

describe('checkRule01', () => {
  it('returns true when restaurant has at least one recommendation', async () => {
    mockCount.mockResolvedValue(2);
    expect(await checkRule01('rest1')).toBe(true);
    expect(mockCount).toHaveBeenCalledWith({ where: { restaurant_id: 'rest1' } });
  });

  it('returns false when restaurant has no recommendations', async () => {
    mockCount.mockResolvedValue(0);
    expect(await checkRule01('rest1')).toBe(false);
  });
});

// ── checkRule03 ───────────────────────────────────────────────────────────────

describe('checkRule03', () => {
  it('returns true (vote allowed) when no existing vote found', async () => {
    mockVoteFindFirst.mockResolvedValue(null as never);
    expect(await checkRule03('rec1', 'fp-abc')).toBe(true);
    expect(mockVoteFindFirst).toHaveBeenCalledWith({
      where: { recommendation_id: 'rec1', fingerprint: 'fp-abc' },
    });
  });

  it('returns false (vote blocked) when duplicate vote exists', async () => {
    mockVoteFindFirst.mockResolvedValue({ id: 'vote1' } as never);
    expect(await checkRule03('rec1', 'fp-abc')).toBe(false);
  });
});

// ── checkRule05 ───────────────────────────────────────────────────────────────

describe('checkRule05', () => {
  it('returns true (vote allowed) when no existing restaurant vote found', async () => {
    mockRestaurantVoteFindFirst.mockResolvedValue(null as never);
    expect(await checkRule05('rest1', 'fp-abc')).toBe(true);
    expect(mockRestaurantVoteFindFirst).toHaveBeenCalledWith({
      where: { restaurant_id: 'rest1', fingerprint: 'fp-abc' },
    });
  });

  it('returns false (vote blocked) when duplicate restaurant vote exists', async () => {
    mockRestaurantVoteFindFirst.mockResolvedValue({ id: 'rv1' } as never);
    expect(await checkRule05('rest1', 'fp-abc')).toBe(false);
  });
});

// ── tryTransitionToVerified ───────────────────────────────────────────────────

describe('tryTransitionToVerified', () => {
  it('does nothing when restaurant is not found', async () => {
    mockRestaurantFindUnique.mockResolvedValue(null as never);
    await tryTransitionToVerified('rest1');
    expect(mockRestaurantUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when restaurant is already VERIFIED', async () => {
    mockRestaurantFindUnique.mockResolvedValue({ id: 'rest1', status: 'VERIFIED' } as never);
    await tryTransitionToVerified('rest1');
    expect(mockRestaurantUpdate).not.toHaveBeenCalled();
  });

  it('does nothing when RULE_01 fails (no recommendations)', async () => {
    mockRestaurantFindUnique.mockResolvedValue({ id: 'rest1', status: 'UNREVIEWED' } as never);
    mockCount.mockResolvedValue(0);
    await tryTransitionToVerified('rest1');
    expect(mockRestaurantUpdate).not.toHaveBeenCalled();
  });

  it('transitions to VERIFIED when UNREVIEWED and RULE_01 passes', async () => {
    mockRestaurantFindUnique.mockResolvedValue({ id: 'rest1', status: 'UNREVIEWED' } as never);
    mockCount.mockResolvedValue(1);
    mockRestaurantUpdate.mockResolvedValue({} as never);
    await tryTransitionToVerified('rest1');
    expect(mockRestaurantUpdate).toHaveBeenCalledWith({
      where: { id: 'rest1' },
      data: { status: 'VERIFIED' },
    });
  });

  it('does nothing when status is FLAGGED (not UNREVIEWED)', async () => {
    mockRestaurantFindUnique.mockResolvedValue({ id: 'rest1', status: 'FLAGGED' } as never);
    await tryTransitionToVerified('rest1');
    expect(mockRestaurantUpdate).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });
});
