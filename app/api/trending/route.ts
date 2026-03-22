import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detect_city, extractIp } from '@/lib/geo';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let city: string | null = searchParams.get('city');

  if (!city) {
    const ip = extractIp(request.headers);
    city = await detect_city(ip);
  }

  if (!city) city = 'Ottawa';

  let restaurants = await prisma.restaurant.findMany({
    where: { city: { equals: city, mode: 'insensitive' } },
    include: {
      recommendations: {
        select: { id: true },
      },
    },
  });

  const ranked = restaurants
    .map((r) => ({
      id: r.id,
      name: r.name,
      city: r.city,
      address: r.address,
      price_range: r.price_range,
      hours: r.hours,
      status: r.status,
      recommendation_count: r.recommendations.length,
      total_net_votes: r.upvotes - r.downvotes,
    }))
    .sort((a, b) => b.total_net_votes - a.total_net_votes)
    .slice(0, 10);

  return NextResponse.json({ city, results: ranked });
}
