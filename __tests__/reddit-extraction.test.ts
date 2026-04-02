/**
 * Tests for lib/reddit.ts — extractRestaurantName (exported pure function)
 */

import { describe, it, expect } from 'vitest';
import { extractRestaurantName } from '@/lib/reddit';

describe('extractRestaurantName', () => {
  // ── Quoted text ──────────────────────────────────────────────────────────

  it('extracts double-quoted restaurant name', () => {
    expect(extractRestaurantName('I went to "Zen Kitchen" last night')).toBe('Zen Kitchen');
  });

  it('extracts single-quoted restaurant name', () => {
    expect(extractRestaurantName("Has anyone tried 'Arlo Bistro'?")).toBe('Arlo Bistro');
  });

  // ── Pattern matching ─────────────────────────────────────────────────────

  it('extracts name from "tried X" pattern', () => {
    const result = extractRestaurantName('I tried Shawarma Palace last week');
    expect(result).toBe('Shawarma Palace');
  });

  it('extracts name from "recommend X" pattern', () => {
    const result = extractRestaurantName('I recommend Falafel Corner for lunch');
    expect(result).toBe('Falafel Corner');
  });

  it('extracts name from "X is amazing" pattern', () => {
    const result = extractRestaurantName('Zen Kitchen is amazing for vegetarians');
    expect(result).toBe('Zen Kitchen');
  });

  it('extracts name from "at X restaurant" pattern', () => {
    const result = extractRestaurantName('Had dinner at Blue Cactus restaurant');
    expect(result).toBe('Blue Cactus');
  });

  it('extracts name from "going to X" pattern', () => {
    const result = extractRestaurantName('going to Mama\'s Kitchen for dinner');
    expect(result).not.toBeNull();
  });

  // ── Capitalized words fallback ────────────────────────────────────────────

  it('falls back to capitalized word sequence', () => {
    const result = extractRestaurantName('Noodle House Ottawa has the best ramen');
    expect(result).toBe('Noodle House Ottawa');
  });

  it('skips generic skip-list words as first word', () => {
    // "Best" is in the skip list
    expect(extractRestaurantName('Best Thai Place in the city')).toBeNull();
  });

  it('skips generic skip-list word as first word in fallback', () => {
    // "Looking" is in the skip list; no pattern matches "Looking For Great Sushi Options"
    expect(extractRestaurantName('Looking For Great Sushi Options')).toBeNull();
  });

  it('skips "Looking" as first word', () => {
    expect(extractRestaurantName('Looking For Good Sushi')).toBeNull();
  });

  // ── Returns null cases ────────────────────────────────────────────────────

  it('returns null for plain lowercase text', () => {
    const result = extractRestaurantName('what are good restaurants near me');
    expect(result).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractRestaurantName('')).toBeNull();
  });

  it('returns null when only skip words are capitalized', () => {
    expect(extractRestaurantName('Any Good Recommendations For Downtown')).toBeNull();
  });

  // ── Priority: quoted text takes precedence over patterns ─────────────────

  it('prefers quoted text over pattern matches', () => {
    const result = extractRestaurantName('I tried "Zen Kitchen" and recommend Arlo Bistro');
    expect(result).toBe('Zen Kitchen');
  });
});
