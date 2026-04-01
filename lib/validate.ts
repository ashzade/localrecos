/**
 * Runtime validators for in-memory data types.
 * These enforce the field-level constraints defined in manifest.json's dataModel section.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ── ParsedQuery (in-memory) ──────────────────────────────────────────────────

export function validateParsedQuery(obj: Record<string, unknown>): void {
  if (obj.terms === null || obj.terms === undefined) {
    throw new ValidationError("Field 'terms' is required on ParsedQuery (in-memory).");
  }
  if (obj.terms === '') {
    throw new ValidationError("Field 'terms' must not be empty.");
  }
  if (obj.raw === null || obj.raw === undefined) {
    throw new ValidationError("Field 'raw' is required on ParsedQuery (in-memory).");
  }
  if (obj.raw === '') {
    throw new ValidationError("Field 'raw' must not be empty.");
  }
}

// ── RedditPost (in-memory) ───────────────────────────────────────────────────

const REDDIT_POST_STRING_FIELDS = ['id', 'title', 'selftext', 'url', 'permalink', 'subreddit'] as const;

export function validateRedditPost(obj: Record<string, unknown>): void {
  for (const field of REDDIT_POST_STRING_FIELDS) {
    if (obj[field] === null || obj[field] === undefined) {
      throw new ValidationError(`Field '${field}' is required on RedditPost (in-memory).`);
    }
    if (obj[field] === '') {
      throw new ValidationError(`Field '${field}' must not be empty.`);
    }
  }
  if (obj.score === null || obj.score === undefined) {
    throw new ValidationError("Field 'score' is required on RedditPost (in-memory).");
  }
  if (obj.created_utc === null || obj.created_utc === undefined) {
    throw new ValidationError("Field 'created_utc' is required on RedditPost (in-memory).");
  }
}

// ── ExtractedRestaurant (in-memory) ─────────────────────────────────────────

export function validateExtractedRestaurant(obj: Record<string, unknown>): void {
  if (obj.name === null || obj.name === undefined) {
    throw new ValidationError("Field 'name' is required on ExtractedRestaurant (in-memory).");
  }
  if (obj.name === '') {
    throw new ValidationError("Field 'name' must not be empty.");
  }
  if (obj.summary === null || obj.summary === undefined) {
    throw new ValidationError("Field 'summary' is required on ExtractedRestaurant (in-memory).");
  }
  if (obj.summary === '') {
    throw new ValidationError("Field 'summary' must not be empty.");
  }
  if (obj.source === null || obj.source === undefined) {
    throw new ValidationError("Field 'source' is required on ExtractedRestaurant (in-memory).");
  }
  if (obj.source === '') {
    throw new ValidationError("Field 'source' must not be empty.");
  }
}

// ── PlaceDetails (in-memory) ─────────────────────────────────────────────────

export function validatePlaceDetails(obj: Record<string, unknown>): void {
  if (obj.name === null || obj.name === undefined) {
    throw new ValidationError("Field 'name' is required on PlaceDetails (in-memory).");
  }
  if (obj.name === '') {
    throw new ValidationError("Field 'name' must not be empty.");
  }
  if (obj.service_options === null || obj.service_options === undefined) {
    throw new ValidationError("Field 'service_options' is required on PlaceDetails (in-memory).");
  }
}

// ── Restaurant (DB entity — application-layer pre-write guard) ───────────────

export function validateRestaurantInput(obj: Record<string, unknown>): void {
  if (obj.name === null || obj.name === undefined) {
    throw new ValidationError("Field 'name' is required on Restaurant.");
  }
  if (obj.name === '') {
    throw new ValidationError("Field 'name' must not be empty.");
  }
  if (obj.city === null || obj.city === undefined) {
    throw new ValidationError("Field 'city' is required on Restaurant.");
  }
  if (obj.city === '') {
    throw new ValidationError("Field 'city' must not be empty.");
  }
  if (obj.service_options === null || obj.service_options === undefined) {
    throw new ValidationError("Field 'service_options' is required on Restaurant.");
  }
  if (obj.status === null || obj.status === undefined) {
    throw new ValidationError("Field 'status' is required on Restaurant.");
  }
  if (obj.upvotes === null || obj.upvotes === undefined) {
    throw new ValidationError("Field 'upvotes' is required on Restaurant.");
  }
  if (obj.downvotes === null || obj.downvotes === undefined) {
    throw new ValidationError("Field 'downvotes' is required on Restaurant.");
  }
}

// ── CommunityRecommendation (DB entity — application-layer pre-write guard) ──

export function validateCommunityRecommendationInput(obj: Record<string, unknown>): void {
  if (obj.restaurant_id === null || obj.restaurant_id === undefined) {
    throw new ValidationError("Field 'restaurant_id' is required on CommunityRecommendation.");
  }
  if (obj.restaurant_id === '') {
    throw new ValidationError("Field 'restaurant_id' must not be empty.");
  }
  if (obj.source === null || obj.source === undefined) {
    throw new ValidationError("Field 'source' is required on CommunityRecommendation.");
  }
  if (obj.source === '') {
    throw new ValidationError("Field 'source' must not be empty.");
  }
  if (obj.post_url === null || obj.post_url === undefined) {
    throw new ValidationError("Field 'post_url' is required on CommunityRecommendation.");
  }
  if (obj.post_url === '') {
    throw new ValidationError("Field 'post_url' must not be empty.");
  }
  if (obj.summary === null || obj.summary === undefined) {
    throw new ValidationError("Field 'summary' is required on CommunityRecommendation.");
  }
  if (obj.summary === '') {
    throw new ValidationError("Field 'summary' must not be empty.");
  }
  if (obj.mention_count === null || obj.mention_count === undefined) {
    throw new ValidationError("Field 'mention_count' is required on CommunityRecommendation.");
  }
  if (obj.source_upvotes === null || obj.source_upvotes === undefined) {
    throw new ValidationError("Field 'source_upvotes' is required on CommunityRecommendation.");
  }
  if (obj.upvotes === null || obj.upvotes === undefined) {
    throw new ValidationError("Field 'upvotes' is required on CommunityRecommendation.");
  }
  if (obj.downvotes === null || obj.downvotes === undefined) {
    throw new ValidationError("Field 'downvotes' is required on CommunityRecommendation.");
  }
}

// ── RestaurantVote (DB entity — application-layer pre-write guard) ────────────

export function validateRestaurantVoteInput(obj: Record<string, unknown>): void {
  if (obj.restaurant_id === null || obj.restaurant_id === undefined) {
    throw new ValidationError("Field 'restaurant_id' is required on RestaurantVote.");
  }
  if (obj.restaurant_id === '') {
    throw new ValidationError("Field 'restaurant_id' must not be empty.");
  }
  if (obj.fingerprint === null || obj.fingerprint === undefined) {
    throw new ValidationError("Field 'fingerprint' is required on RestaurantVote.");
  }
  if (obj.fingerprint === '') {
    throw new ValidationError("Field 'fingerprint' must not be empty.");
  }
  if (obj.direction === null || obj.direction === undefined) {
    throw new ValidationError("Field 'direction' is required on RestaurantVote.");
  }
}

// ── Vote (DB entity — application-layer pre-write guard) ─────────────────────

export function validateVoteInput(obj: Record<string, unknown>): void {
  if (obj.recommendation_id === null || obj.recommendation_id === undefined) {
    throw new ValidationError("Field 'recommendation_id' is required on Vote.");
  }
  if (obj.recommendation_id === '') {
    throw new ValidationError("Field 'recommendation_id' must not be empty.");
  }
  if (obj.fingerprint === null || obj.fingerprint === undefined) {
    throw new ValidationError("Field 'fingerprint' is required on Vote.");
  }
  if (obj.fingerprint === '') {
    throw new ValidationError("Field 'fingerprint' must not be empty.");
  }
  if (obj.direction === null || obj.direction === undefined) {
    throw new ValidationError("Field 'direction' is required on Vote.");
  }
}
