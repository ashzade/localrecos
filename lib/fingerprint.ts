import { createHash } from 'crypto';
import { type NextRequest } from 'next/server';

/**
 * Compute a privacy-preserving fingerprint from a request.
 * We hash the IP + User-Agent together using SHA-256.
 * The raw IP is never stored anywhere.
 */
export function computeFingerprint(request: NextRequest): string {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';

  const ua = request.headers.get('user-agent') || 'unknown';

  return createHash('sha256')
    .update(`${ip}:${ua}`)
    .digest('hex');
}
