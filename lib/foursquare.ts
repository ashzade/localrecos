import * as https from 'https';

const FSQ_BASE = 'places-api.foursquare.com';
const FSQ_VERSION = '2025-06-17';

function fsqGet(path: string, apiKey: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: FSQ_BASE,
        path,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'X-Places-Api-Version': FSQ_VERSION,
          Accept: 'application/json',
        },
        timeout: 8000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString() }));
        res.on('error', reject);
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.end();
  });
}

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
      categories: '13065',
      limit: '1',
      fields: 'fsq_place_id,name,location,tel,website,hours,price,photos,attributes',
    });

    const { status, body } = await fsqGet(`/places/search?${params}`, apiKey);
    if (status < 200 || status >= 300) return null;

    const data = JSON.parse(body);
    const results = data.results;
    if (!results || results.length === 0) return null;

    return buildPlaceDetails(results[0]);
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

  // Service options — field renamed from features to attributes
  const serviceOptions: string[] = [];
  const attributes = place.attributes as Record<string, unknown> | undefined;
  const services = attributes?.services as Record<string, unknown> | undefined;
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
 * Search Foursquare for restaurants matching a query in a city.
 * Used as a fallback when Reddit returns no results.
 */
export async function searchFoursquare(
  city: string,
  query: string,
  limit = 5
): Promise<PlaceDetails[]> {
  const apiKey = process.env.FOURSQUARE_API_KEY;
  if (!apiKey || !city.trim()) return [];

  try {
    const params = new URLSearchParams({
      query,
      near: city,
      categories: '13065',
      limit: String(limit),
      fields: 'fsq_place_id,name,location,tel,website,hours,price,photos,attributes',
    });

    const reqPath = `/places/search?${params}`;
    console.log(`[foursquare] GET https://${FSQ_BASE}${reqPath}`);

    let result: { status: number; body: string } | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        result = await fsqGet(reqPath, apiKey);
        break;
      } catch (err) {
        if (attempt === 2) throw err;
        console.warn(`[foursquare] attempt ${attempt} threw, retrying…`, String(err));
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (!result) throw new Error('fsqGet returned no result');

    const { status, body } = result;

    if (status < 200 || status >= 300) {
      console.error(`[foursquare] search failed status=${status}`, body.slice(0, 500));
      return [];
    }

    const data = JSON.parse(body);
    const results = data.results;
    if (!Array.isArray(results)) {
      console.error('[foursquare] unexpected response shape', body.slice(0, 200));
      return [];
    }

    return results.map((place: Record<string, unknown>) => buildPlaceDetails(place));
  } catch (err) {
    console.error('[foursquare] search threw', err);
    return [];
  }
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
