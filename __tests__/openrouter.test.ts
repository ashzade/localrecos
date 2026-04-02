/**
 * Tests for lib/openrouter.ts — parseQueryWithLLM and getRedditRecommendations
 * Focus: regex fallback (no API key) and error recovery paths.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { parseQueryWithLLM, getRedditRecommendations } from '@/lib/openrouter';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.OPENROUTER_API_KEY;
});

// ── parseQueryWithLLM — regex fallback (no API key) ──────────────────────────

describe('parseQueryWithLLM — regex fallback', () => {
  it('extracts city after "in"', async () => {
    const result = await parseQueryWithLLM('best sushi in Ottawa');
    expect(result.city).toBe('Ottawa');
    expect(result.terms).toContain('sushi');
  });

  it('extracts city after "near"', async () => {
    const result = await parseQueryWithLLM('ramen near Toronto');
    expect(result.city).toBe('Toronto');
    expect(result.terms).toContain('ramen');
  });

  it('returns null city when no location marker', async () => {
    const result = await parseQueryWithLLM('best sushi');
    expect(result.city).toBeNull();
    expect(result.terms).toBe('best sushi');
  });

  it('returns full query as terms when no city', async () => {
    const result = await parseQueryWithLLM('vegetarian restaurants');
    expect(result.city).toBeNull();
    expect(result.terms).toBe('vegetarian restaurants');
  });

  it('does not call fetch when no API key', async () => {
    await parseQueryWithLLM('sushi in Ottawa');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

// ── parseQueryWithLLM — API path ─────────────────────────────────────────────

describe('parseQueryWithLLM — with API key', () => {
  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
  });

  it('returns parsed city and terms from API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ city: 'Ottawa', terms: 'sushi' }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await parseQueryWithLLM('sushi in Ottawa');
    expect(result.city).toBe('Ottawa');
    expect(result.terms).toBe('sushi');
  });

  it('falls back to regex when API returns non-ok status', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve('Service Unavailable'),
    });
    const result = await parseQueryWithLLM('ramen in Toronto');
    expect(result.city).toBe('Toronto');
    expect(result.terms).toContain('ramen');
  });

  it('falls back to regex when API response has no content', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ choices: [] }),
      text: () => Promise.resolve(''),
    });
    const result = await parseQueryWithLLM('pizza in Vancouver');
    expect(result.city).toBe('Vancouver');
  });

  it('falls back to regex when fetch throws', async () => {
    mockFetch.mockRejectedValue(new Error('network error'));
    const result = await parseQueryWithLLM('tacos in Calgary');
    expect(result.city).toBe('Calgary');
  });

  it('returns null city when API returns city: null', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ city: null, terms: 'sushi' }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await parseQueryWithLLM('sushi');
    expect(result.city).toBeNull();
    expect(result.terms).toBe('sushi');
  });

  it('trims whitespace from city', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ city: '  Ottawa  ', terms: 'sushi' }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await parseQueryWithLLM('sushi Ottawa');
    expect(result.city).toBe('Ottawa');
  });

  it('returns null city for empty-string city in API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ city: '   ', terms: 'sushi' }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await parseQueryWithLLM('sushi');
    expect(result.city).toBeNull();
  });
});

// ── getRedditRecommendations ─────────────────────────────────────────────────

describe('getRedditRecommendations', () => {
  it('returns empty array when no API key', async () => {
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns parsed recommendations from API', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const recs = [
      { name: 'Zen Kitchen', summary: 'Great sushi, highly rated.' },
      { name: 'Sushi Shop', summary: 'Popular with locals.' },
    ];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ restaurants: recs }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await getRedditRecommendations('sushi in Ottawa', 'Ottawa', 'sushi');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Zen Kitchen');
    expect(result[1].summary).toBe('Popular with locals.');
  });

  it('returns empty array when API call fails', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('error'),
    });
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toEqual([]);
  });

  it('returns empty array when fetch throws', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockFetch.mockRejectedValue(new Error('timeout'));
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toEqual([]);
  });

  it('filters out recommendations with missing name or summary', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({
          restaurants: [
            { name: 'Zen Kitchen', summary: 'Great' },
            { name: null, summary: 'No name' },
            { name: 'Missing Summary' },
          ],
        }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Zen Kitchen');
  });

  it('strips <think>...</think> blocks from response', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    const recs = [{ name: 'Zen Kitchen', summary: 'Great.' }];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: `<think>reasoning here</think>${JSON.stringify({ restaurants: recs })}` } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Zen Kitchen');
  });

  it('returns empty array when restaurants is not an array', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: JSON.stringify({ restaurants: 'not an array' }) } }],
      }),
      text: () => Promise.resolve(''),
    });
    const result = await getRedditRecommendations('sushi', 'Ottawa', 'sushi');
    expect(result).toEqual([]);
  });
});
