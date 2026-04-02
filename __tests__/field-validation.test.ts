/**
 * Adversarial field-validation tests — T01 through T57
 * Generated from manifest.json dataModel required-field constraints.
 */

import { describe, it, expect } from 'vitest';

// Cast helper for adversarial tests that deliberately supply invalid field values.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const bad = (x: unknown): any => x;

import {
  validateParsedQuery,
  validateRedditPost,
  validateExtractedRestaurant,
  validatePlaceDetails,
  validateRestaurantInput,
  validateCommunityRecommendationInput,
  validateRestaurantVoteInput,
  validateVoteInput,
  ValidationError,
} from '@/lib/validate';

// ── ParsedQuery (in-memory) ───────────────────────────────────────────────────

describe('ParsedQuery field validation', () => {
  // T01
  it('T01: rejects when terms is null', () => {
    expect(() => validateParsedQuery(bad({ terms: null, raw: 'pizza ottawa', city: null })))
      .toThrow(ValidationError);
    expect(() => validateParsedQuery(bad({ terms: null, raw: 'pizza ottawa', city: null })))
      .toThrow("Field 'terms' is required on ParsedQuery (in-memory).");
  });

  // T02
  it('T02: rejects when terms is empty string', () => {
    expect(() => validateParsedQuery(bad({ terms: '', raw: 'pizza ottawa', city: null })))
      .toThrow("Field 'terms' must not be empty.");
  });

  // T03
  it('T03: rejects when raw is null', () => {
    expect(() => validateParsedQuery(bad({ terms: 'pizza', raw: null, city: null })))
      .toThrow("Field 'raw' is required on ParsedQuery (in-memory).");
  });

  // T04
  it('T04: rejects when raw is empty string', () => {
    expect(() => validateParsedQuery(bad({ terms: 'pizza', raw: '', city: null })))
      .toThrow("Field 'raw' must not be empty.");
  });

  it('passes a valid ParsedQuery', () => {
    expect(() => validateParsedQuery({ city: 'Ottawa', terms: 'pizza', raw: 'pizza ottawa' }))
      .not.toThrow();
  });

  it('passes when city is null (nullable field)', () => {
    expect(() => validateParsedQuery({ city: null, terms: 'pizza', raw: 'pizza' }))
      .not.toThrow();
  });
});

// ── RedditPost (in-memory) ────────────────────────────────────────────────────

const validPost = {
  id: 'abc123',
  title: 'Best sushi in Ottawa',
  selftext: 'I love sushi',
  url: 'https://reddit.com/abc',
  permalink: 'https://reddit.com/r/ottawa/abc',
  subreddit: 'ottawa',
  score: 42,
  created_utc: 1711900000,
};

describe('RedditPost field validation', () => {
  // T05
  it('T05: rejects when id is null', () => {
    expect(() => validateRedditPost({ ...validPost, id: null }))
      .toThrow("Field 'id' is required on RedditPost (in-memory).");
  });

  // T06
  it('T06: rejects when id is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, id: '' }))
      .toThrow("Field 'id' must not be empty.");
  });

  // T07
  it('T07: rejects when title is null', () => {
    expect(() => validateRedditPost({ ...validPost, title: null }))
      .toThrow("Field 'title' is required on RedditPost (in-memory).");
  });

  // T08
  it('T08: rejects when title is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, title: '' }))
      .toThrow("Field 'title' must not be empty.");
  });

  // T09
  it('T09: rejects when selftext is null', () => {
    expect(() => validateRedditPost({ ...validPost, selftext: null }))
      .toThrow("Field 'selftext' is required on RedditPost (in-memory).");
  });

  // T10
  it('T10: rejects when selftext is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, selftext: '' }))
      .toThrow("Field 'selftext' must not be empty.");
  });

  // T11
  it('T11: rejects when url is null', () => {
    expect(() => validateRedditPost({ ...validPost, url: null }))
      .toThrow("Field 'url' is required on RedditPost (in-memory).");
  });

  // T12
  it('T12: rejects when url is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, url: '' }))
      .toThrow("Field 'url' must not be empty.");
  });

  // T13
  it('T13: rejects when permalink is null', () => {
    expect(() => validateRedditPost({ ...validPost, permalink: null }))
      .toThrow("Field 'permalink' is required on RedditPost (in-memory).");
  });

  // T14
  it('T14: rejects when permalink is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, permalink: '' }))
      .toThrow("Field 'permalink' must not be empty.");
  });

  // T15
  it('T15: rejects when subreddit is null', () => {
    expect(() => validateRedditPost({ ...validPost, subreddit: null }))
      .toThrow("Field 'subreddit' is required on RedditPost (in-memory).");
  });

  // T16
  it('T16: rejects when subreddit is empty string', () => {
    expect(() => validateRedditPost({ ...validPost, subreddit: '' }))
      .toThrow("Field 'subreddit' must not be empty.");
  });

  // T17
  it('T17: rejects when score is null', () => {
    expect(() => validateRedditPost({ ...validPost, score: null }))
      .toThrow("Field 'score' is required on RedditPost (in-memory).");
  });

  // T18
  it('T18: rejects when created_utc is null', () => {
    expect(() => validateRedditPost({ ...validPost, created_utc: null }))
      .toThrow("Field 'created_utc' is required on RedditPost (in-memory).");
  });

  it('passes a valid RedditPost', () => {
    expect(() => validateRedditPost(validPost)).not.toThrow();
  });
});

// ── ExtractedRestaurant (in-memory) ──────────────────────────────────────────

const validExtracted = {
  name: 'Sushi Palace',
  summary: 'Great tuna rolls',
  source: 'r/ottawa',
};

describe('ExtractedRestaurant field validation', () => {
  // T19
  it('T19: rejects when name is null', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, name: null }))
      .toThrow("Field 'name' is required on ExtractedRestaurant (in-memory).");
  });

  // T20
  it('T20: rejects when name is empty string', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, name: '' }))
      .toThrow("Field 'name' must not be empty.");
  });

  // T21
  it('T21: rejects when summary is null', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, summary: null }))
      .toThrow("Field 'summary' is required on ExtractedRestaurant (in-memory).");
  });

  // T22
  it('T22: rejects when summary is empty string', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, summary: '' }))
      .toThrow("Field 'summary' must not be empty.");
  });

  // T23
  it('T23: rejects when source is null', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, source: null }))
      .toThrow("Field 'source' is required on ExtractedRestaurant (in-memory).");
  });

  // T24
  it('T24: rejects when source is empty string', () => {
    expect(() => validateExtractedRestaurant({ ...validExtracted, source: '' }))
      .toThrow("Field 'source' must not be empty.");
  });

  it('passes a valid ExtractedRestaurant', () => {
    expect(() => validateExtractedRestaurant(validExtracted)).not.toThrow();
  });
});

// ── PlaceDetails (in-memory) ──────────────────────────────────────────────────

const validPlace = {
  name: 'Sushi Palace Ottawa',
  address: '123 Main St',
  phone: null,
  website: null,
  hours: null,
  price_range: '$$',
  service_options: ['Dine-in'],
  photo_url: null,
};

describe('PlaceDetails field validation', () => {
  // T25
  it('T25: rejects when name is null', () => {
    expect(() => validatePlaceDetails({ ...validPlace, name: null }))
      .toThrow("Field 'name' is required on PlaceDetails (in-memory).");
  });

  // T26
  it('T26: rejects when name is empty string', () => {
    expect(() => validatePlaceDetails({ ...validPlace, name: '' }))
      .toThrow("Field 'name' must not be empty.");
  });

  // T27
  it('T27: rejects when service_options is null', () => {
    expect(() => validatePlaceDetails({ ...validPlace, service_options: null }))
      .toThrow("Field 'service_options' is required on PlaceDetails (in-memory).");
  });

  it('passes a valid PlaceDetails', () => {
    expect(() => validatePlaceDetails(validPlace)).not.toThrow();
  });
});

// ── Restaurant (DB entity) ────────────────────────────────────────────────────

const validRestaurant = {
  name: 'Sushi Palace',
  city: 'Ottawa',
  address: null,
  phone: null,
  website: null,
  hours: null,
  price_range: null,
  service_options: [],
  status: 'UNREVIEWED',
  photo_url: null,
  upvotes: 0,
  downvotes: 0,
};

describe('Restaurant input validation', () => {
  // T28
  it('T28: rejects when name is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, name: null }))
      .toThrow("Field 'name' is required on Restaurant.");
  });

  // T29
  it('T29: rejects when name is empty string', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, name: '' }))
      .toThrow("Field 'name' must not be empty.");
  });

  // T30
  it('T30: rejects when city is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, city: null }))
      .toThrow("Field 'city' is required on Restaurant.");
  });

  // T31
  it('T31: rejects when city is empty string', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, city: '' }))
      .toThrow("Field 'city' must not be empty.");
  });

  // T32
  it('T32: rejects when service_options is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, service_options: null }))
      .toThrow("Field 'service_options' is required on Restaurant.");
  });

  // T33
  it('T33: rejects when status is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, status: null }))
      .toThrow("Field 'status' is required on Restaurant.");
  });

  // T34
  it('T34: rejects when upvotes is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, upvotes: null }))
      .toThrow("Field 'upvotes' is required on Restaurant.");
  });

  // T35
  it('T35: rejects when downvotes is null', () => {
    expect(() => validateRestaurantInput({ ...validRestaurant, downvotes: null }))
      .toThrow("Field 'downvotes' is required on Restaurant.");
  });

  it('passes a valid Restaurant input', () => {
    expect(() => validateRestaurantInput(validRestaurant)).not.toThrow();
  });
});

// ── CommunityRecommendation (DB entity) ───────────────────────────────────────

const validRec = {
  restaurant_id: 'rest-uuid-1',
  source: 'r/ottawa',
  post_url: 'https://reddit.com/r/ottawa/abc',
  summary: 'Great sushi here',
  mention_count: 1,
  source_upvotes: 10,
  upvotes: 0,
  downvotes: 0,
};

describe('CommunityRecommendation input validation', () => {
  // T36
  it('T36: rejects when restaurant_id is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, restaurant_id: null }))
      .toThrow("Field 'restaurant_id' is required on CommunityRecommendation.");
  });

  // T37
  it('T37: rejects when restaurant_id is empty string', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, restaurant_id: '' }))
      .toThrow("Field 'restaurant_id' must not be empty.");
  });

  // T38
  it('T38: rejects when source is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, source: null }))
      .toThrow("Field 'source' is required on CommunityRecommendation.");
  });

  // T39
  it('T39: rejects when source is empty string', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, source: '' }))
      .toThrow("Field 'source' must not be empty.");
  });

  // T40
  it('T40: rejects when post_url is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, post_url: null }))
      .toThrow("Field 'post_url' is required on CommunityRecommendation.");
  });

  // T41
  it('T41: rejects when post_url is empty string', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, post_url: '' }))
      .toThrow("Field 'post_url' must not be empty.");
  });

  // T42
  it('T42: rejects when summary is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, summary: null }))
      .toThrow("Field 'summary' is required on CommunityRecommendation.");
  });

  // T43
  it('T43: rejects when summary is empty string', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, summary: '' }))
      .toThrow("Field 'summary' must not be empty.");
  });

  // T44
  it('T44: rejects when mention_count is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, mention_count: null }))
      .toThrow("Field 'mention_count' is required on CommunityRecommendation.");
  });

  // T45
  it('T45: rejects when source_upvotes is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, source_upvotes: null }))
      .toThrow("Field 'source_upvotes' is required on CommunityRecommendation.");
  });

  // T46
  it('T46: rejects when upvotes is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, upvotes: null }))
      .toThrow("Field 'upvotes' is required on CommunityRecommendation.");
  });

  // T47
  it('T47: rejects when downvotes is null', () => {
    expect(() => validateCommunityRecommendationInput({ ...validRec, downvotes: null }))
      .toThrow("Field 'downvotes' is required on CommunityRecommendation.");
  });

  it('passes a valid CommunityRecommendation input', () => {
    expect(() => validateCommunityRecommendationInput(validRec)).not.toThrow();
  });
});

// ── RestaurantVote (DB entity) ────────────────────────────────────────────────

const validRestVote = {
  restaurant_id: 'rest-uuid-1',
  fingerprint: 'fp-abc123',
  direction: 'up',
};

describe('RestaurantVote input validation', () => {
  // T48
  it('T48: rejects when restaurant_id is null', () => {
    expect(() => validateRestaurantVoteInput({ ...validRestVote, restaurant_id: null }))
      .toThrow("Field 'restaurant_id' is required on RestaurantVote.");
  });

  // T49
  it('T49: rejects when restaurant_id is empty string', () => {
    expect(() => validateRestaurantVoteInput({ ...validRestVote, restaurant_id: '' }))
      .toThrow("Field 'restaurant_id' must not be empty.");
  });

  // T50
  it('T50: rejects when fingerprint is null', () => {
    expect(() => validateRestaurantVoteInput({ ...validRestVote, fingerprint: null }))
      .toThrow("Field 'fingerprint' is required on RestaurantVote.");
  });

  // T51
  it('T51: rejects when fingerprint is empty string', () => {
    expect(() => validateRestaurantVoteInput({ ...validRestVote, fingerprint: '' }))
      .toThrow("Field 'fingerprint' must not be empty.");
  });

  // T52
  it('T52: rejects when direction is null', () => {
    expect(() => validateRestaurantVoteInput({ ...validRestVote, direction: null }))
      .toThrow("Field 'direction' is required on RestaurantVote.");
  });

  it('passes a valid RestaurantVote input', () => {
    expect(() => validateRestaurantVoteInput(validRestVote)).not.toThrow();
  });
});

// ── Vote (DB entity) ──────────────────────────────────────────────────────────

const validVote = {
  recommendation_id: 'rec-uuid-1',
  fingerprint: 'fp-abc123',
  direction: 'up',
};

describe('Vote input validation', () => {
  // T53
  it('T53: rejects when recommendation_id is null', () => {
    expect(() => validateVoteInput({ ...validVote, recommendation_id: null }))
      .toThrow("Field 'recommendation_id' is required on Vote.");
  });

  // T54
  it('T54: rejects when recommendation_id is empty string', () => {
    expect(() => validateVoteInput({ ...validVote, recommendation_id: '' }))
      .toThrow("Field 'recommendation_id' must not be empty.");
  });

  // T55
  it('T55: rejects when fingerprint is null', () => {
    expect(() => validateVoteInput({ ...validVote, fingerprint: null }))
      .toThrow("Field 'fingerprint' is required on Vote.");
  });

  // T56
  it('T56: rejects when fingerprint is empty string', () => {
    expect(() => validateVoteInput({ ...validVote, fingerprint: '' }))
      .toThrow("Field 'fingerprint' must not be empty.");
  });

  // T57
  it('T57: rejects when direction is null', () => {
    expect(() => validateVoteInput({ ...validVote, direction: null }))
      .toThrow("Field 'direction' is required on Vote.");
  });

  it('passes a valid Vote input', () => {
    expect(() => validateVoteInput(validVote)).not.toThrow();
  });
});
