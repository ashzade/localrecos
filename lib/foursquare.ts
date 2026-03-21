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
 * Look up a restaurant on Foursquare Places.
 * Returns null gracefully if the API key is missing or the search returns no results.
 */
export async function lookupRestaurant(
  name: string,
  city: string
): Promise<PlaceDetails | null> {
  if (!city || !city.trim()) return null;

  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return null;

  try {
    const params = new URLSearchParams({
      query: name,
      near: city,
      categories: '13065', // Food category
      limit: '1',
      fields: 'fsq_id,name,location,tel,website,hours,price,photos,features',
    });

    const response = await fetch(
      `https://api.foursquare.com/v3/places/search?${params}`,
      {
        headers: { Authorization: apiKey },
        next: { revalidate: 86400 },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const results = data.results;
    if (!results || results.length === 0) return null;

    const place = results[0];

    return buildPlaceDetails(place);
  } catch {
    return null;
  }
}

function buildPlaceDetails(place: Record<string, unknown>): PlaceDetails {
  const priceMap: Record<number, string> = { 1: '$', 2: '$$', 3: '$$$', 4: '$$$$' };

  // Address
  const location = place.location as Record<string, unknown> | undefined;
  const address = (location?.formatted_address as string) ?? null;

  // Price
  const price_range =
    typeof place.price === 'number' ? (priceMap[place.price] ?? null) : null;

  // Hours
  let hours: string | null = null;
  const hoursData = place.hours as Record<string, unknown> | undefined;
  if (Array.isArray(hoursData?.display) && hoursData.display.length > 0) {
    hours = (hoursData.display as string[]).join(' | ');
  }

  // Service options
  const serviceOptions: string[] = [];
  const features = place.features as Record<string, unknown> | undefined;
  const services = features?.services as Record<string, unknown> | undefined;
  if (services?.dine_in) serviceOptions.push('Dine-in');
  if (services?.takeout) serviceOptions.push('Takeout');
  if (services?.delivery) serviceOptions.push('Delivery');

  // Photo — format: prefix + size + suffix
  let photo_url: string | null = null;
  const photos = place.photos as Array<Record<string, string>> | undefined;
  if (photos && photos.length > 0) {
    const { prefix, suffix } = photos[0];
    if (prefix && suffix) photo_url = `${prefix}600x400${suffix}`;
  }

  return {
    name: (place.name as string) ?? '',
    address,
    phone: (place.tel as string) ?? null,
    website: (place.website as string) ?? null,
    hours,
    price_range,
    service_options: serviceOptions,
    photo_url,
  };
}

/**
 * Check whether Foursquare can find the restaurant.
 * Returns true (assume exists) if API key is missing.
 */
export async function isRestaurantVerified(name: string, city: string): Promise<boolean> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey) return true;

  const result = await lookupRestaurant(name, city);
  return result !== null;
}
