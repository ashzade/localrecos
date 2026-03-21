import { NextRequest, NextResponse } from 'next/server';
import { scrapeRedditForRestaurants } from '@/lib/reddit';
import { lookupRestaurant, isRestaurantVerified } from '@/lib/foursquare';
import { applyRule02 } from '@/lib/rules';
import prisma from '@/lib/db';
import { RestaurantStatus } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let body: { city?: string; query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { city, query } = body;

  if (!city || !query) {
    return NextResponse.json(
      { error: 'city and query are required' },
      { status: 400 }
    );
  }

  try {
    const extracted = await scrapeRedditForRestaurants(city, query);

    let created = 0;
    let skipped = 0;

    for (const item of extracted) {
      // Check if we already have a restaurant with this name in this city
      const existing = await prisma.restaurant.findFirst({
        where: {
          name: { equals: item.name, mode: 'insensitive' },
          city: { equals: city, mode: 'insensitive' },
        },
      });

      if (existing) {
        // Add a new recommendation if the post URL isn't already stored
        const existingRec = await prisma.communityRecommendation.findFirst({
          where: {
            restaurant_id: existing.id,
            post_url: item.postUrl,
          },
        });

        if (!existingRec) {
          await prisma.communityRecommendation.create({
            data: {
              restaurant_id: existing.id,
              source: item.source,
              post_url: item.postUrl,
              summary: item.summary,
              source_upvotes: item.redditScore,
            },
          });
          created++;
        } else {
          skipped++;
        }
        continue;
      }

      // Look up on Google Places
      const placeDetails = await lookupRestaurant(item.name, city);
      const verified = placeDetails !== null;

      // Create restaurant
      const restaurant = await prisma.restaurant.create({
        data: {
          name: placeDetails?.name ?? item.name,
          city,
          address: placeDetails?.address ?? null,
          phone: placeDetails?.phone ?? null,
          website: placeDetails?.website ?? null,
          hours: placeDetails?.hours ?? null,
          price_range: placeDetails?.price_range ?? null,
          service_options: placeDetails?.service_options ?? [],
          photo_url: placeDetails?.photo_url ?? null,
          status: RestaurantStatus.UNREVIEWED,
          details_verified: verified,
        },
      });

      // Apply RULE_02 if Places lookup failed
      if (!verified) {
        await applyRule02(restaurant.id);
      }

      // Create the community recommendation
      await prisma.communityRecommendation.create({
        data: {
          restaurant_id: restaurant.id,
          source: item.source,
          post_url: item.postUrl,
          summary: item.summary,
          source_upvotes: item.redditScore,
        },
      });

      created++;
    }

    return NextResponse.json({
      success: true,
      scraped: extracted.length,
      created,
      skipped,
    });
  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Scrape failed', details: String(error) },
      { status: 500 }
    );
  }
}
