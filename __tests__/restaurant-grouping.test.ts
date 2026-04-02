/**
 * Tests for lib/restaurant-grouping.ts — groupRestaurantsByName, normalizeWebsite
 */

import { describe, it, expect } from 'vitest';
import { groupRestaurantsByName, normalizeWebsite } from '@/lib/restaurant-grouping';
import type { GroupableRestaurant } from '@/lib/restaurant-grouping';

function makeRestaurant(overrides: Partial<GroupableRestaurant> & { id: string; name: string }): GroupableRestaurant {
  return {
    city: 'Ottawa',
    address: null,
    phone: null,
    website: null,
    hours: null,
    price_range: null,
    photo_url: null,
    status: 'UNREVIEWED',
    upvotes: 0,
    downvotes: 0,
    total_net_votes: 0,
    recommendations: [],
    ...overrides,
  };
}

// ── normalizeWebsite ──────────────────────────────────────────────────────────

describe('normalizeWebsite', () => {
  it('returns null for null input', () => {
    expect(normalizeWebsite(null)).toBeNull();
  });

  it('strips www. prefix', () => {
    expect(normalizeWebsite('https://www.zenkitchen.ca')).toBe('zenkitchen.ca');
  });

  it('strips https:// and www.', () => {
    expect(normalizeWebsite('https://www.example.com/path')).toBe('example.com');
  });

  it('works without protocol', () => {
    expect(normalizeWebsite('zenkitchen.ca')).toBe('zenkitchen.ca');
  });

  it('lowercases the result', () => {
    expect(normalizeWebsite('https://ZenKitchen.CA')).toBe('zenkitchen.ca');
  });

  it('strips path from URL', () => {
    expect(normalizeWebsite('https://myrestaurant.com/menu')).toBe('myrestaurant.com');
  });
});

// ── groupRestaurantsByName ────────────────────────────────────────────────────

describe('groupRestaurantsByName', () => {
  it('returns empty array for empty input', () => {
    expect(groupRestaurantsByName([])).toEqual([]);
  });

  it('groups exact-name duplicates into one group', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen', address: '1 Main St' }),
      makeRestaurant({ id: 'r2', name: 'zen kitchen', address: '2 Bank St' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups).toHaveLength(1);
    expect(groups[0].locations).toHaveLength(2);
  });

  it('keeps distinct names as separate groups', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen' }),
      makeRestaurant({ id: 'r2', name: 'Arlo Bistro' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups).toHaveLength(2);
  });

  it('merges groups sharing the same website', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen', website: 'https://zenkitchen.ca' }),
      makeRestaurant({ id: 'r2', name: 'Zen Kitchen Glebe', website: 'https://www.zenkitchen.ca' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups).toHaveLength(1);
    expect(groups[0].locations).toHaveLength(2);
  });

  it('merges groups where one name is a prefix of the other (min 5 chars)', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Shawarma Palace' }),
      makeRestaurant({ id: 'r2', name: 'Shawarma Palace Barrhaven' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups).toHaveLength(1);
  });

  it('does NOT merge short prefix names (< 5 chars)', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen' }),
      makeRestaurant({ id: 'r2', name: 'Zen Garden' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    // "Zen" is only 3 chars — should NOT merge
    expect(groups).toHaveLength(2);
  });

  it('does NOT merge completely unrelated names', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Shawarma Palace', website: 'https://shawarmapalace.ca' }),
      makeRestaurant({ id: 'r2', name: 'Zen Kitchen', website: 'https://zenkitchen.ca' }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups).toHaveLength(2);
  });

  it('primary location is the one with highest net votes', () => {
    const restaurants = [
      makeRestaurant({ id: 'low', name: 'Zen Kitchen', upvotes: 2, downvotes: 1, total_net_votes: 1 }),
      makeRestaurant({ id: 'high', name: 'Zen Kitchen', upvotes: 10, downvotes: 0, total_net_votes: 10 }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups[0].id).toBe('high');
  });

  it('aggregates upvotes and downvotes across locations', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen', upvotes: 3, downvotes: 1, total_net_votes: 2 }),
      makeRestaurant({ id: 'r2', name: 'Zen Kitchen', upvotes: 5, downvotes: 2, total_net_votes: 3 }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups[0].upvotes).toBe(8);
    expect(groups[0].downvotes).toBe(3);
    expect(groups[0].total_net_votes).toBe(5);
  });

  it('deduplicates recommendations by post_url within a group', () => {
    const sharedRec = { id: 'rec1', source: 'reddit', post_url: 'https://reddit.com/r/ottawa/1', summary: 'Great', mention_count: 1, source_upvotes: 10, upvotes: 0, downvotes: 0, scraped_at: new Date() };
    const uniqueRec = { id: 'rec2', source: 'reddit', post_url: 'https://reddit.com/r/ottawa/2', summary: 'Also great', mention_count: 1, source_upvotes: 5, upvotes: 0, downvotes: 0, scraped_at: new Date() };
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen', total_net_votes: 5, recommendations: [sharedRec] }),
      makeRestaurant({ id: 'r2', name: 'Zen Kitchen', total_net_votes: 3, recommendations: [sharedRec, uniqueRec] }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    // sharedRec appears in both but should only be in the merged result once
    expect(groups[0].recommendations).toHaveLength(2);
    const urls = groups[0].recommendations.map(r => r.post_url);
    expect(new Set(urls).size).toBe(2);
  });

  it('sorts groups by total_net_votes descending', () => {
    const restaurants = [
      makeRestaurant({ id: 'low', name: 'Arlo Bistro', total_net_votes: 1 }),
      makeRestaurant({ id: 'high', name: 'Zen Kitchen', total_net_votes: 10 }),
      makeRestaurant({ id: 'mid', name: 'Falafel Corner', total_net_votes: 5 }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    expect(groups.map(g => g.id)).toEqual(['high', 'mid', 'low']);
  });

  it('respects excludeNames when provided', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen' }),
      makeRestaurant({ id: 'r2', name: 'Arlo Bistro' }),
    ];
    const groups = groupRestaurantsByName(restaurants, new Set(['zen kitchen']));
    expect(groups).toHaveLength(1);
    expect(groups[0].name).toBe('Arlo Bistro');
  });

  it('includes correct location data in each location entry', () => {
    const restaurants = [
      makeRestaurant({ id: 'r1', name: 'Zen Kitchen', address: '1 Main St', phone: '613-555-0001', website: 'https://zen.ca', hours: 'Mon-Sun 11am–9pm', upvotes: 3, downvotes: 1 }),
    ];
    const groups = groupRestaurantsByName(restaurants);
    const loc = groups[0].locations[0];
    expect(loc.id).toBe('r1');
    expect(loc.address).toBe('1 Main St');
    expect(loc.phone).toBe('613-555-0001');
    expect(loc.website).toBe('https://zen.ca');
    expect(loc.hours).toBe('Mon-Sun 11am–9pm');
    expect(loc.upvotes).toBe(3);
    expect(loc.downvotes).toBe(1);
  });
});
