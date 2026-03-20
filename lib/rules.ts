import prisma from '@/lib/db';
import { RestaurantStatus } from '@prisma/client';

/**
 * RULE_01: A restaurant can only be VERIFIED if it has at least one community recommendation.
 */
export async function checkRule01(restaurantId: string): Promise<boolean> {
  const count = await prisma.communityRecommendation.count({
    where: { restaurant_id: restaurantId },
  });
  return count > 0;
}

/**
 * RULE_02: If Google Places can't find the restaurant → mark details_verified=false, status=INCOMPLETE.
 * This is called after a failed Places lookup.
 */
export async function applyRule02(restaurantId: string): Promise<void> {
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      details_verified: false,
      status: RestaurantStatus.INCOMPLETE,
    },
  });
}

/**
 * RULE_03: No duplicate votes. Check if a fingerprint has already voted on a recommendation.
 * Returns true if the vote is allowed (no duplicate), false if it must be rejected.
 */
export async function checkRule03(
  recommendationId: string,
  fingerprint: string
): Promise<boolean> {
  const existing = await prisma.vote.findFirst({
    where: {
      recommendation_id: recommendationId,
      fingerprint,
    },
  });
  return existing === null;
}

/**
 * RULE_05: No duplicate restaurant votes. Check if a fingerprint has already voted on a restaurant.
 * Returns true if the vote is allowed (no duplicate), false if it must be rejected.
 */
export async function checkRule05(
  restaurantId: string,
  fingerprint: string
): Promise<boolean> {
  const existing = await prisma.restaurantVote.findFirst({
    where: {
      restaurant_id: restaurantId,
      fingerprint,
    },
  });
  return existing === null;
}

/**
 * After a vote is cast, attempt to transition the restaurant to VERIFIED.
 * State machine:
 *   UNREVIEWED → VERIFIED (guard: RULE_01)
 *   INCOMPLETE → VERIFIED (guard: RULE_01)
 */
export async function tryTransitionToVerified(restaurantId: string): Promise<void> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
  });

  if (!restaurant) return;

  // Only transition from UNREVIEWED or INCOMPLETE
  if (
    restaurant.status !== RestaurantStatus.UNREVIEWED &&
    restaurant.status !== RestaurantStatus.INCOMPLETE
  ) {
    return;
  }

  // Guard: RULE_01
  const hasRecommendations = await checkRule01(restaurantId);
  if (!hasRecommendations) return;

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: { status: RestaurantStatus.VERIFIED },
  });
}
