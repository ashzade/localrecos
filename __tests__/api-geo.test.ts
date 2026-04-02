/**
 * Tests for app/api/geo/route.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/geo', () => ({
  detectCityFromIp: vi.fn(),
  extractIp: vi.fn().mockReturnValue('1.2.3.4'),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { GET } from '@/app/api/geo/route';
import { detectCityFromIp } from '@/lib/geo';

const mockDetectCityFromIp = vi.mocked(detectCityFromIp);

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/geo${qs ? '?' + qs : ''}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.DEFAULT_CITY;
});

describe('GET /api/geo', () => {
  describe('with lat/lon coordinates', () => {
    it('returns city from Nominatim on success', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          address: { city: 'Montreal', road: 'Rue Sainte-Catherine' },
        })),
      });
      const res = await GET(makeRequest({ lat: '45.5', lon: '-73.6' }));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.city).toBe('Montreal');
      expect(body.debug.source).toBe('nominatim');
    });

    it('falls back to town when city is absent in Nominatim response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve(JSON.stringify({
          address: { town: 'Gatineau' },
        })),
      });
      const res = await GET(makeRequest({ lat: '45.47', lon: '-75.7' }));
      const body = await res.json();
      expect(body.city).toBe('Gatineau');
    });

    it('returns city: null when Nominatim responds with an error status', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: () => Promise.resolve('Service Unavailable'),
      });
      const res = await GET(makeRequest({ lat: '45.5', lon: '-73.6' }));
      const body = await res.json();
      expect(body.city).toBeNull();
      expect(body.debug.source).toBe('nominatim_failed');
    });

    it('returns city: null when Nominatim throws a network error', async () => {
      mockFetch.mockRejectedValue(new Error('network error'));
      const res = await GET(makeRequest({ lat: '45.5', lon: '-73.6' }));
      const body = await res.json();
      expect(body.city).toBeNull();
      expect(body.debug.source).toBe('nominatim_error');
    });
  });

  describe('without coordinates (IP geolocation)', () => {
    it('returns city from IP detection', async () => {
      mockDetectCityFromIp.mockResolvedValue('Toronto');
      const res = await GET(makeRequest());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.city).toBe('Toronto');
      expect(body.debug.source).toBe('ip');
    });

    it('falls back to DEFAULT_CITY when IP detection returns null', async () => {
      process.env.DEFAULT_CITY = 'Calgary';
      mockDetectCityFromIp.mockResolvedValue(null);
      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.city).toBe('Calgary');
    });

    it('returns city: null when IP detection fails and no DEFAULT_CITY', async () => {
      mockDetectCityFromIp.mockResolvedValue(null);
      const res = await GET(makeRequest());
      const body = await res.json();
      expect(body.city).toBeNull();
    });
  });
});
