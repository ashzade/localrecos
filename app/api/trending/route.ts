import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { detect_city, extractIp } from '@/lib/geo';
import { searchFoursquare } from '@/lib/foursquare';
import { RestaurantStatus } from '@prisma/client';

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

  // Foursquare fallback: seed the city with popular restaurants if the DB has none
  if (restaurants.length === 0) {
    const places = await searchFoursquare(city, 'restaurants', 10);
    for (const place of places) {
      try {
        const created = await prisma.restaurant.create({
          data: {
            name: place.name,
            city,
            address: place.address,
            phone: place.phone,
            website: place.website,
            hours: place.hours,
            price_range: place.price_range,
            service_options: place.service_options,
            photo_url: place.photo_url,
            status: RestaurantStatus.UNREVIEWED,
          },
        });
        restaurants.push({ ...created, recommendations: [] });
      } catch { /* skip duplicates */ }
    }
  }

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
