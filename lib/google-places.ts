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

/**
 * Look up a restaurant on Google Places.
 * Returns null gracefully if the API key is missing or the search returns no results.
 */
export async function lookupRestaurant(
  name: string,
  city: string
): Promise<PlaceDetails | null> {
  // RULE_04: city context is required
  if (!city || !city.trim()) return null;

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    // Gracefully degrade when no API key is configured
    return null;
  }

  try {
    const query = encodeURIComponent(`${name} restaurant ${city}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${apiKey}&type=restaurant`;

    const response = await fetch(url, {
      next: { revalidate: 86400 }, // Cache for 24 hours
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return null;
    }

    const place = data.results[0];

    // Map price_level (0–4) to price range symbols
    const priceMap: Record<number, string> = {
      1: '$',
      2: '$$',
      3: '$$$',
      4: '$$$$',
    };

    const priceRange = place.price_level != null ? priceMap[place.price_level as number] ?? null : null;

    // Build photo URL from the first photo reference
    let photo_url: string | null = null;
    if (place.photos?.[0]?.photo_reference) {
      photo_url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=600&photoreference=${place.photos[0].photo_reference}&key=${apiKey}`;
    }

    // Fetch detailed info to get phone, website, hours
    const details = await fetchPlaceDetails(place.place_id, apiKey);

    return {
      name: place.name ?? name,
      address: place.formatted_address ?? null,
      phone: details?.phone ?? null,
      website: details?.website ?? null,
      hours: details?.hours ?? null,
      price_range: priceRange,
      service_options: details?.service_options ?? [],
      photo_url,
    };
  } catch {
    return null;
  }
}

interface PlaceDetailsRaw {
  phone: string | null;
  website: string | null;
  hours: string | null;
  service_options: string[];
}

async function fetchPlaceDetails(
  placeId: string,
  apiKey: string
): Promise<PlaceDetailsRaw | null> {
  try {
    const fields = 'formatted_phone_number,website,opening_hours,serves_dine_in,serves_takeout,serves_delivery';
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;

    const response = await fetch(url, {
      next: { revalidate: 86400 },
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status !== 'OK' || !data.result) return null;

    const result = data.result;

    const serviceOptions: string[] = [];
    if (result.serves_dine_in) serviceOptions.push('Dine-in');
    if (result.serves_takeout) serviceOptions.push('Takeout');
    if (result.serves_delivery) serviceOptions.push('Delivery');

    let hours: string | null = null;
    if (result.opening_hours?.weekday_text) {
      hours = (result.opening_hours.weekday_text as string[]).join(' | ');
    }

    return {
      phone: result.formatted_phone_number ?? null,
      website: result.website ?? null,
      hours,
      service_options: serviceOptions,
    };
  } catch {
    return null;
  }
}

/**
 * Check whether Google Places can find the restaurant.
 * Returns false if not found, gracefully returns true (assume exists) if API key is missing.
 */
export async function isRestaurantVerified(name: string, city: string): Promise<boolean> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return true; // Graceful degradation

  const result = await lookupRestaurant(name, city);
  return result !== null;
}
