import { validatePlaceDetails } from '@/lib/validate';

const GOOGLE_PLACES_BASE = 'https://places.googleapis.com/v1';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours',
  'places.priceLevel',
  'places.photos',
  'places.dineIn',
  'places.takeout',
  'places.delivery',
  'places.primaryType',
  'places.businessStatus',
].join(',');

const FOOD_TYPES = new Set([
  'restaurant', 'food', 'meal_takeaway', 'meal_delivery', 'cafe', 'bakery',
  'bar', 'night_club', 'fast_food_restaurant', 'pizza_restaurant',
  'indian_restaurant', 'chinese_restaurant', 'japanese_restaurant',
  'thai_restaurant', 'vietnamese_restaurant', 'korean_restaurant',
  'mexican_restaurant', 'italian_restaurant', 'seafood_restaurant',
  'steak_house', 'hamburger_restaurant', 'sandwich_shop', 'breakfast_restaurant',
  'brunch_restaurant', 'buffet_restaurant', 'food_court', 'ice_cream_shop',
  'dessert_restaurant', 'fine_dining_restaurant', 'diner',
]);

export interface PlaceDetails {
  name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  price_range: string | null;
  service_options: string[];
  photo_url: string | null;
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: '$',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

function buildPlaceDetails(place: Record<string, unknown>, apiKey: string): PlaceDetails {
  const displayName = place.displayName as Record<string, string> | undefined;
  const name = displayName?.text ?? '';

  const address = (place.formattedAddress as string) ?? null;
  const phone = (place.nationalPhoneNumber as string) ?? null;
  const website = (place.websiteUri as string) ?? null;

  let hours: string | null = null;
  const openingHours = place.regularOpeningHours as Record<string, unknown> | undefined;
  const weekdayDescriptions = openingHours?.weekdayDescriptions as string[] | undefined;
  if (weekdayDescriptions && weekdayDescriptions.length > 0) {
    hours = weekdayDescriptions.join(' | ');
  }

  const price_range =
    typeof place.priceLevel === 'string' ? (PRICE_MAP[place.priceLevel] ?? null) : null;

  const service_options: string[] = [];
  if (place.dineIn) service_options.push('Dine-in');
  if (place.takeout) service_options.push('Takeout');
  if (place.delivery) service_options.push('Delivery');

  let photo_url: string | null = null;
  const photos = place.photos as Array<Record<string, string>> | undefined;
  if (photos && photos.length > 0 && photos[0].name) {
    photo_url = `${GOOGLE_PLACES_BASE}/${photos[0].name}/media?maxWidthPx=600&maxHeightPx=400&key=${apiKey}`;
  }

  return { name, address, phone, website, hours, price_range, service_options, photo_url };
}

async function resolvePhotoUrl(photoUrl: string): Promise<string | null> {
  try {
    // Add skipHttpRedirect=true to get the final CDN URL as JSON instead of a redirect
    const url = photoUrl.replace('/media?', '/media?skipHttpRedirect=true&');
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return (data.photoUri as string) ?? null;
  } catch {
    return null;
  }
}

/**
 * Search Google Places for restaurants matching a query in a city.
 */
export async function searchGooglePlaces(
  city: string,
  query: string,
  limit = 5
): Promise<PlaceDetails[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey || !city.trim()) return [];

  const textQuery = `${query} in ${city}`;
  console.log(`[google-places] textQuery="${textQuery}"`);

  try {
    const response = await fetch(`${GOOGLE_PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery,
        maxResultCount: limit,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error(`[google-places] search failed status=${response.status}`, await response.text());
      return [];
    }

    const data = await response.json();
    const places = data.places;
    if (!Array.isArray(places)) {
      console.error('[google-places] unexpected response shape', JSON.stringify(data).slice(0, 200));
      return [];
    }

    const results = places
      .filter((place: Record<string, unknown>) => {
        const primaryType = place.primaryType as string | undefined;
        if (!primaryType || !FOOD_TYPES.has(primaryType)) {
          console.warn('Google Places returned a non-food venue for this name; skipping.');
          return false;
        }
        if (place.businessStatus === 'CLOSED_PERMANENTLY') return false;
        return true;
      })
      .map((place: Record<string, unknown>) => buildPlaceDetails(place, apiKey))
      .filter((details) => {
        try {
          validatePlaceDetails(details as unknown as Record<string, unknown>);
          return true;
        } catch {
          return false;
        }
      });

    // Resolve photo redirects to final CDN URLs so Next.js Image can display them
    await Promise.all(
      results.map(async (r) => {
        if (r.photo_url) {
          r.photo_url = await resolvePhotoUrl(r.photo_url) ?? r.photo_url;
        }
      })
    );

    return results;
  } catch (err) {
    console.error('[google-places] search threw', err);
    return [];
  }
}
