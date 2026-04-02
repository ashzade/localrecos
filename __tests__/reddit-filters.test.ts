/**
 * Tests for lib/reddit.ts — isRecommendationRequest, isPostRelevantToQuery, isValidRestaurantName
 */

import { describe, it, expect } from 'vitest';
import {
  isRecommendationRequest,
  isPostRelevantToQuery,
  isValidRestaurantName,
  type RedditPost,
} from '@/lib/reddit';

function makePost(overrides: Partial<RedditPost> = {}): RedditPost {
  return {
    id: 'p1',
    title: 'Best sushi in Ottawa?',
    selftext: '',
    url: 'https://reddit.com',
    permalink: '/r/ottawa/p1',
    subreddit: 'ottawa',
    score: 5,
    created_utc: 0,
    ...overrides,
  };
}

// ── isRecommendationRequest ───────────────────────────────────────────────────

describe('isRecommendationRequest', () => {
  it('matches question-mark titles', () => {
    expect(isRecommendationRequest('Best sushi in Ottawa?')).toBe(true);
  });

  it('matches "recommend" keyword', () => {
    expect(isRecommendationRequest('Can anyone recommend a good ramen place?')).toBe(true);
  });

  it('matches "looking for" phrase', () => {
    expect(isRecommendationRequest('Looking for good Thai food')).toBe(true);
  });

  it('matches "suggestions" keyword', () => {
    expect(isRecommendationRequest('Suggestions for date night restaurants?')).toBe(true);
  });

  it('matches "where to" phrase', () => {
    expect(isRecommendationRequest('Where to get the best pho')).toBe(true);
  });

  it('returns false for review/experience posts', () => {
    expect(isRecommendationRequest('Just tried Zen Kitchen — amazing food')).toBe(false);
  });

  it('returns false for plain statements', () => {
    expect(isRecommendationRequest('Shawarma Palace opened a new location downtown')).toBe(false);
  });
});

// ── isPostRelevantToQuery ─────────────────────────────────────────────────────

describe('isPostRelevantToQuery', () => {
  it('returns true when query word appears in title', () => {
    const post = makePost({ title: 'Best sushi restaurants in Ottawa', selftext: '' });
    expect(isPostRelevantToQuery(post, 'sushi')).toBe(true);
  });

  it('returns true when query word appears in selftext', () => {
    const post = makePost({ title: 'Food recommendations', selftext: 'Looking for good ramen' });
    expect(isPostRelevantToQuery(post, 'ramen')).toBe(true);
  });

  it('returns false when query word is absent from post', () => {
    const post = makePost({ title: 'Best pizza places', selftext: 'deep dish or thin crust' });
    expect(isPostRelevantToQuery(post, 'sushi')).toBe(false);
  });

  it('returns true when all query words are stop words (no meaningful filter)', () => {
    const post = makePost({ title: 'anything', selftext: '' });
    expect(isPostRelevantToQuery(post, 'the best')).toBe(true);
  });

  it('is case-insensitive', () => {
    const post = makePost({ title: 'SUSHI PLACES', selftext: '' });
    expect(isPostRelevantToQuery(post, 'sushi')).toBe(true);
  });

  it('returns true for empty query (no words survive filter)', () => {
    const post = makePost({ title: 'anything', selftext: '' });
    expect(isPostRelevantToQuery(post, '')).toBe(true);
  });
});

// ── isValidRestaurantName ─────────────────────────────────────────────────────

describe('isValidRestaurantName', () => {
  it('accepts a typical capitalized restaurant name', () => {
    expect(isValidRestaurantName('Zen Kitchen')).toBe(true);
  });

  it('accepts single-word capitalized name', () => {
    expect(isValidRestaurantName('Shawarma')).toBe(true);
  });

  it('rejects names starting with lowercase', () => {
    expect(isValidRestaurantName('zen kitchen')).toBe(false);
  });

  it('rejects names with more than 6 words', () => {
    expect(isValidRestaurantName('The Best Little Sushi Place In Ottawa Ontario')).toBe(false);
  });

  it('rejects names starting with invalid phrase "The best"', () => {
    expect(isValidRestaurantName('The best ramen')).toBe(false);
  });

  it('rejects names starting with "In "', () => {
    expect(isValidRestaurantName('In Ottawa')).toBe(false);
  });

  it('rejects names with no 3-letter sequence', () => {
    expect(isValidRestaurantName('A B')).toBe(false);
  });

  it('accepts names with ampersand', () => {
    expect(isValidRestaurantName('Salt & Pepper')).toBe(true);
  });

  it('accepts up to 6 words', () => {
    expect(isValidRestaurantName('The Keg Steakhouse Bar Grill Ottawa')).toBe(true);
  });
});
