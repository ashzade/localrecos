/**
 * IP geolocation using ip-api.com (free, no API key needed).
 * Returns the city name, or null if detection fails.
 * Alias: detect_city (used by GeoDetector.detect_city in the spec)
 */
export async function detect_city(ip: string): Promise<string | null> {
  // Skip for localhost / private addresses
  if (
    !ip ||
    ip === 'unknown' ||
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip.startsWith('192.168.') ||
    ip.startsWith('10.') ||
    ip.startsWith('172.')
  ) {
    return null;
  }

  try {
    const response = await fetch(`http://ip-api.com/json/${ip}?fields=status,city`, {
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) return null;

    const data = await response.json();

    if (data.status === 'success' && data.city) {
      return data.city as string;
    }

    return null;
  } catch {
    return null;
  }
}

/** Alias for backward compatibility */
export const detectCityFromIp = detect_city;

/**
 * Extract client IP from request headers.
 */
export function extractIp(headers: Headers): string {
  return (
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    headers.get('x-real-ip') ||
    'unknown'
  );
}
