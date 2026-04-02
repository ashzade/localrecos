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

function requireString(obj: Record<string, unknown>, field: string, entity: string): void {
  if (obj[field] === null || obj[field] === undefined) {
    throw new ValidationError(`Field '${field}' is required on ${entity}.`);
  }
  if (obj[field] === '') {
    throw new ValidationError(`Field '${field}' must not be empty.`);
  }
}

function requirePresent(obj: Record<string, unknown>, field: string, entity: string): void {
  if (obj[field] === null || obj[field] === undefined) {
    throw new ValidationError(`Field '${field}' is required on ${entity}.`);
  }
}

// ── ParsedQuery (in-memory) ──────────────────────────────────────────────────

interface ParsedQuery {
  city?: string | null;
  terms?: string | null;
  raw?: string | null;
}

export function validateParsedQuery(obj: ParsedQuery): void {
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'terms', 'ParsedQuery (in-memory)');
  requireString(o, 'raw', 'ParsedQuery (in-memory)');
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
  const o = obj as unknown as Record<string, unknown>;
  for (const field of REDDIT_POST_STRING_FIELDS) {
    requireString(o, field, 'RedditPost (in-memory)');
  }
  requirePresent(o, 'score', 'RedditPost (in-memory)');
  requirePresent(o, 'created_utc', 'RedditPost (in-memory)');
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
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'name', 'ExtractedRestaurant (in-memory)');
  requireString(o, 'summary', 'ExtractedRestaurant (in-memory)');
  requireString(o, 'source', 'ExtractedRestaurant (in-memory)');
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
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'name', 'PlaceDetails (in-memory)');
  requirePresent(o, 'service_options', 'PlaceDetails (in-memory)');
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
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'name', 'Restaurant');
  requireString(o, 'city', 'Restaurant');
  requirePresent(o, 'service_options', 'Restaurant');
  requirePresent(o, 'status', 'Restaurant');
  requirePresent(o, 'upvotes', 'Restaurant');
  requirePresent(o, 'downvotes', 'Restaurant');
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
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'restaurant_id', 'CommunityRecommendation');
  requireString(o, 'source', 'CommunityRecommendation');
  requireString(o, 'post_url', 'CommunityRecommendation');
  requireString(o, 'summary', 'CommunityRecommendation');
  requirePresent(o, 'mention_count', 'CommunityRecommendation');
  requirePresent(o, 'source_upvotes', 'CommunityRecommendation');
  requirePresent(o, 'upvotes', 'CommunityRecommendation');
  requirePresent(o, 'downvotes', 'CommunityRecommendation');
}

// ── RestaurantVote (DB entity — application-layer pre-write guard) ────────────

interface RestaurantVoteInput {
  restaurant_id?: string | null;
  fingerprint?: string | null;
  direction?: string | null;
}

export function validateRestaurantVoteInput(obj: RestaurantVoteInput): void {
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'restaurant_id', 'RestaurantVote');
  requireString(o, 'fingerprint', 'RestaurantVote');
  requirePresent(o, 'direction', 'RestaurantVote');
}

// ── Vote (DB entity — application-layer pre-write guard) ─────────────────────

interface VoteInput {
  recommendation_id?: string | null;
  fingerprint?: string | null;
  direction?: string | null;
}

export function validateVoteInput(obj: VoteInput): void {
  const o = obj as unknown as Record<string, unknown>;
  requireString(o, 'recommendation_id', 'Vote');
  requireString(o, 'fingerprint', 'Vote');
  requirePresent(o, 'direction', 'Vote');
}
