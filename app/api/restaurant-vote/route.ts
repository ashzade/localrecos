import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { computeFingerprint } from '@/lib/fingerprint';
import { checkRule05, tryTransitionToVerified } from '@/lib/rules';
import { VoteDirection } from '@prisma/client';
import { validateRestaurantVoteInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { restaurant_id?: string; direction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { restaurant_id, direction } = body;

  if (!restaurant_id || !direction) {
    return NextResponse.json(
      { error: 'restaurant_id and direction are required' },
      { status: 400 }
    );
  }

  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json(
      { error: 'direction must be "up" or "down"' },
      { status: 400 }
    );
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurant_id },
  });

  if (!restaurant) {
    return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
  }

  const fingerprint = computeFingerprint(request);

  // RULE_05: No duplicate restaurant votes
  const allowed = await checkRule05(restaurant_id, fingerprint);
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'RULE_05',
        message: 'You have already voted on this restaurant.',
      },
      { status: 409 }
    );
  }

  const voteDirection = direction === 'up' ? VoteDirection.up : VoteDirection.down;

  validateRestaurantVoteInput({ restaurant_id, fingerprint, direction } as unknown as Record<string, unknown>);

  await prisma.$transaction(async (tx) => {
    await tx.restaurantVote.create({
      data: {
        restaurant_id,
        fingerprint,
        direction: voteDirection,
      },
    });

    if (direction === 'up') {
      await tx.restaurant.update({
        where: { id: restaurant_id },
        data: { upvotes: { increment: 1 } },
      });
    } else {
      await tx.restaurant.update({
        where: { id: restaurant_id },
        data: { downvotes: { increment: 1 } },
      });
    }
  });

  // Attempt state transition UNREVIEWED/INCOMPLETE → VERIFIED
  await tryTransitionToVerified(restaurant_id);

  const updated = await prisma.restaurant.findUnique({
    where: { id: restaurant_id },
    select: { upvotes: true, downvotes: true },
  });

  return NextResponse.json({
    success: true,
    upvotes: updated?.upvotes ?? 0,
    downvotes: updated?.downvotes ?? 0,
    net_votes: (updated?.upvotes ?? 0) - (updated?.downvotes ?? 0),
  });
}
