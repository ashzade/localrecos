/**
 * Runtime validators for in-memory data types.
 * These enforce the field-level constraints defined in manifest.json's dataModel section.
 *
 * Interfaces are defined locally (mirroring the source types) to avoid circular imports.
 * TypeScript structural typing means callers can pass their richer typed objects directly.
 */

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ── ParsedQuery (in-memory) ──────────────────────────────────────────────────

interface ParsedQuery {
  city?: string | null;
  terms?: string | null;
  raw?: string | null;
}

export function validateParsedQuery(obj: ParsedQuery): void {
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

interface RedditPost {
  id?: string | null;
  title?: string | null;
  selftext?: string | null;
  url?: string | null;
  permalink?: string | null;
  subreddit?: string | null;
  score?: number | null;
  created_utc?: number | null;
}

const REDDIT_POST_STRING_FIELDS = ['id', 'title', 'selftext', 'url', 'permalink', 'subreddit'] as const;

export function validateRedditPost(obj: RedditPost): void {
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

interface ExtractedRestaurant {
  name?: string | null;
  postUrl?: string | null;
  summary?: string | null;
  source?: string | null;
  redditScore?: number | null;
}

export function validateExtractedRestaurant(obj: ExtractedRestaurant): void {
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

interface PlaceDetails {
  name?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  hours?: string | null;
  price_range?: string | null;
  service_options?: string[] | null;
  photo_url?: string | null;
}

export function validatePlaceDetails(obj: PlaceDetails): void {
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

interface RestaurantInput {
  name?: string | null;
  city?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  hours?: string | null;
  price_range?: string | null;
  service_options?: string[] | null;
  status?: string | null;
  photo_url?: string | null;
  upvotes?: number | null;
  downvotes?: number | null;
}

export function validateRestaurantInput(obj: RestaurantInput): void {
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

interface CommunityRecommendationInput {
  restaurant_id?: string | null;
  source?: string | null;
  post_url?: string | null;
  summary?: string | null;
  mention_count?: number | null;
  source_upvotes?: number | null;
  upvotes?: number | null;
  downvotes?: number | null;
}

export function validateCommunityRecommendationInput(obj: CommunityRecommendationInput): void {
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

interface RestaurantVoteInput {
  restaurant_id?: string | null;
  fingerprint?: string | null;
  direction?: string | null;
}

export function validateRestaurantVoteInput(obj: RestaurantVoteInput): void {
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

interface VoteInput {
  recommendation_id?: string | null;
  fingerprint?: string | null;
  direction?: string | null;
}

export function validateVoteInput(obj: VoteInput): void {
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
