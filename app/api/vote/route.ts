import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { computeFingerprint } from '@/lib/fingerprint';
import { checkRule03, tryTransitionToVerified } from '@/lib/rules';
import { VoteDirection } from '@prisma/client';
import { validateVoteInput } from '@/lib/validate';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { recommendation_id?: string; direction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { recommendation_id, direction } = body;

  if (!recommendation_id || !direction) {
    return NextResponse.json(
      { error: 'recommendation_id and direction are required' },
      { status: 400 }
    );
  }

  if (direction !== 'up' && direction !== 'down') {
    return NextResponse.json(
      { error: 'direction must be "up" or "down"' },
      { status: 400 }
    );
  }

  const recommendation = await prisma.communityRecommendation.findUnique({
    where: { id: recommendation_id },
  });

  if (!recommendation) {
    return NextResponse.json({ error: 'Recommendation not found' }, { status: 404 });
  }

  const fingerprint = computeFingerprint(request);

  // RULE_03: No duplicate votes
  const allowed = await checkRule03(recommendation_id, fingerprint);
  if (!allowed) {
    return NextResponse.json(
      {
        error: 'RULE_03',
        message: 'You have already voted on this recommendation.',
      },
      { status: 409 }
    );
  }

  const voteDirection = direction === 'up' ? VoteDirection.up : VoteDirection.down;

  validateVoteInput({ recommendation_id, fingerprint, direction });

  await prisma.$transaction(async (tx) => {
    await tx.vote.create({
      data: {
        recommendation_id,
        fingerprint,
        direction: voteDirection,
      },
    });

    if (direction === 'up') {
      await tx.communityRecommendation.update({
        where: { id: recommendation_id },
        data: { upvotes: { increment: 1 } },
      });
    } else {
      await tx.communityRecommendation.update({
        where: { id: recommendation_id },
        data: { downvotes: { increment: 1 } },
      });
    }
  });

  // Attempt state transition UNREVIEWED/INCOMPLETE → VERIFIED
  await tryTransitionToVerified(recommendation.restaurant_id);

  const updated = await prisma.communityRecommendation.findUnique({
    where: { id: recommendation_id },
    select: { upvotes: true, downvotes: true },
  });

  return NextResponse.json({
    success: true,
    upvotes: updated?.upvotes ?? 0,
    downvotes: updated?.downvotes ?? 0,
    net_votes: (updated?.upvotes ?? 0) - (updated?.downvotes ?? 0),
  });
}
