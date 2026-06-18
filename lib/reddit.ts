import { validateRedditPost, validateExtractedRestaurant } from '@/lib/validate';

function pushIfValid(results: ExtractedRestaurant[], extracted: ExtractedRestaurant): void {
  try {
    validateExtractedRestaurant(extracted);
    results.push(extracted);
  } catch {
    console.warn('Extracted restaurant must have a name and city to proceed with enrichment.');
  }
}

export interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  url: string;
  permalink: string;
  subreddit: string;
  score: number;
  created_utc: number;
}

export interface ExtractedRestaurant {
  name: string;
  postUrl: string;
  summary: string;
  source: string;
  redditScore: number;
}

const SUBREDDIT_MAP: Record<string, string[]> = {
  ottawa: ['ottawa', 'ottawafoodies'],
  toronto: ['toronto', 'askTO'],
  vancouver: ['vancouver', 'vancouverfood'],
  montreal: ['montreal', 'montrealfoodies'],
  calgary: ['calgary'],
  edmonton: ['edmonton'],
  winnipeg: ['winnipeg'],
  halifax: ['halifax'],
  'new york': ['nyc', 'AskNYC'],
  'new york city': ['nyc', 'AskNYC'],
  nyc: ['nyc', 'AskNYC'],
  london: ['london', 'unitedkingdom'],
  chicago: ['chicago'],
  seattle: ['seattle'],
  austin: ['austin'],
  denver: ['denver'],
  boston: ['boston'],
  miami: ['miami'],
  'los angeles': ['LosAngeles', 'FoodLosAngeles'],
  la: ['LosAngeles', 'FoodLosAngeles'],
  'san francisco': ['sanfrancisco', 'bayarea'],
  sf: ['sanfrancisco', 'bayarea'],
};

function getSubreddits(city: string): string[] {
  const key = city.toLowerCase().trim();
  if (SUBREDDIT_MAP[key]) return SUBREDDIT_MAP[key];
  const slug = key.replace(/\s+/g, '');
  return [slug, `${slug}food`];
}

const USER_AGENT = process.env.REDDIT_USER_AGENT || 'LocalRecos/1.0';
const CLIENT_ID = process.env.REDDIT_CLIENT_ID;
const CLIENT_SECRET = process.env.REDDIT_CLIENT_SECRET;

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (!data.access_token) return null;

    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };
    return cachedToken.token;
  } catch {
    return null;
  }
}

function buildHeaders(token: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function fetchSubredditPosts(
  subreddit: string,
  query: string
): Promise<RedditPost[]> {
  const encodedQuery = encodeURIComponent(query);
  const token = await getAccessToken();
  const headers = buildHeaders(token);

  const base = token
    ? `https://oauth.reddit.com/r/${subreddit}/search`
    : `https://www.reddit.com/r/${subreddit}/search.json`;

  // Search by relevance to find text-matched posts, not just top-voted
  const url = `${base}?q=${encodedQuery}&sort=relevance&t=all&limit=25&restrict_sr=1`;

  try {
    const response = await fetch(url, { headers, next: { revalidate: 3600 } });
    if (!response.ok) return [];

    const data = await response.json();
    const posts: RedditPost[] = [];

    if (data?.data?.children) {
      for (const child of data.data.children) {
        const post = child.data;
        if (post && post.title) {
          const redditPost = {
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            url: post.url,
            permalink: `https://www.reddit.com${post.permalink}`,
            subreddit: post.subreddit,
            score: post.score || 0,
            created_utc: post.created_utc || 0,
          };
          try {
            validateRedditPost(redditPost);
            posts.push(redditPost);
          } catch {
            console.warn('Reddit post is missing required fields; cannot extract restaurants.');
          }
        }
      }
    }

    return posts;
  } catch {
    return [];
  }
}

// Detect posts that are asking for recommendations (rather than reviewing a specific place)
const REQUEST_PATTERNS = [
  /\b(best|good|great|authentic|recommend|looking for|suggestions?|where (to|can)|any(one|where)|hidden gem)\b/i,
  /\?/,
];

export function isRecommendationRequest(title: string): boolean {
  return REQUEST_PATTERNS.some((p) => p.test(title));
}

const STOP_WORDS = new Set([
  'best', 'good', 'great', 'any', 'where', 'what', 'which', 'the', 'a', 'an',
  'in', 'for', 'to', 'of', 'and', 'or', 'is', 'are', 'can', 'get', 'find',
  'looking', 'recommend', 'recommendations', 'suggestion', 'suggestions',
]);

/**
 * Check that a post is actually about the search query.
 * Extracts meaningful words from the query and checks if at least one appears
 * in the post title or body, to avoid mining comments from unrelated posts.
 */
export function isPostRelevantToQuery(post: RedditPost, query: string): boolean {
  const queryWords = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  if (queryWords.length === 0) return true;

  const haystack = `${post.title} ${post.selftext}`.toLowerCase();
  return queryWords.some((word) => haystack.includes(word));
}

// Validate that an extracted string looks like a restaurant name
export function isValidRestaurantName(name: string): boolean {
  const words = name.trim().split(/\s+/);
  // Must be 1-6 words
  if (words.length > 6) return false;
  // Must start with a capital letter
  if (!/^[A-Z]/.test(name)) return false;
  // Must not be a common English phrase fragment
  const invalidStarts = /^(The\s+best|A\s+lot|In\s+|On\s+|At\s+|Of\s+|For\s+|From\s+|With\s+)/i;
  if (invalidStarts.test(name)) return false;
  // Must contain at least one letter sequence of 3+ chars
  if (!/[a-zA-Z]{3}/.test(name)) return false;
  return true;
}

async function fetchPostComments(
  subreddit: string,
  postId: string,
  token: string | null
): Promise<string[]> {
  const base = token
    ? `https://oauth.reddit.com/r/${subreddit}/comments/${postId}`
    : `https://www.reddit.com/r/${subreddit}/comments/${postId}.json`;

  try {
    const response = await fetch(`${base}?limit=50&depth=1`, {
      headers: buildHeaders(token),
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];

    const data = await response.json();
    // Comments are in the second element of the array
    const commentListing = Array.isArray(data) ? data[1] : null;
    if (!commentListing?.data?.children) return [];

    return commentListing.data.children
      .map((c: { data?: { body?: string } }) => c.data?.body || '')
      .filter((b: string) => b.length > 10);
  } catch {
    return [];
  }
}

/**
 * Extract likely restaurant name from a Reddit post title or comment.
 */
export function extractRestaurantName(title: string): string | null {
  // 1. Quoted text
  const doubleQuoteMatch = title.match(/"([^"]{2,60})"/);
  if (doubleQuoteMatch) return doubleQuoteMatch[1].trim();

  const singleQuoteMatch = title.match(/'([^']{2,60})'/);
  if (singleQuoteMatch) return singleQuoteMatch[1].trim();

  // 2. Common recommendation patterns
  const patterns = [
    /\btried?\s+([A-Z][a-zA-Z'\s&]{2,40}?)(?:\s+(?:and|for|last|this|today|yesterday|in|at|on)|[,!?.]|$)/,
    /\brecommend(?:ing)?\s+([A-Z][a-zA-Z'\s&]{2,40}?)(?:\s+(?:for|in|at|to)|[,!?.]|$)/,
    /\b([A-Z][a-zA-Z'\s&]{2,40}?)\s+is\s+(?:amazing|great|fantastic|excellent|awesome|the best|incredible|wonderful)/i,
    /\bbest\s+(?:\w+\s+)?(?:restaurant|place|spot|food)\s+is\s+([A-Z][a-zA-Z'\s&]{2,40}?)(?:[,!?.]|$)/i,
    /\bcheck(?:ed)?\s+out\s+([A-Z][a-zA-Z'\s&]{2,40}?)(?:\s+(?:and|last|this)|[,!?.]|$)/,
    /\bat\s+([A-Z][a-zA-Z'\s&]{2,40}?)\s+(?:restaurant|bistro|cafe|bar|grill|kitchen|house|place)/i,
    /\bgo(?:ing)?\s+to\s+([A-Z][a-zA-Z'\s&]{2,40}?)(?:\s+(?:for|in|is)|[,!?.]|$)/,
  ];

  for (const pattern of patterns) {
    const match = title.match(pattern);
    if (match && match[1] && match[1].trim().length >= 2) {
      return match[1].trim();
    }
  }

  // 3. Fall back: first 3-4 consecutive capitalized words
  const capitalizedWords = title.match(/\b([A-Z][a-zA-Z']+(?:\s+[A-Z][a-zA-Z']+){1,3})\b/);
  if (capitalizedWords) {
    const candidate = capitalizedWords[1].trim();
    const skipWords = new Set([
      'Best', 'Top', 'Great', 'Good', 'Most', 'Any', 'What', 'Where',
      'Which', 'Looking', 'Need', 'Help', 'Recommendations', 'Anyone',
      'Does', 'Has', 'Are', 'Can', 'Should', 'Would', 'Could', 'New',
      'Inexpensive', 'Authentic', 'Cheap', 'Hidden', 'Local',
      // First-person / common sentence starters
      'I', 'We', 'They', 'You', 'He', 'She', 'It', 'My', 'Our',
      // Neighbourhood/area indicators (not restaurant names)
      'Downtown', 'Uptown', 'North', 'South', 'East', 'West', 'Central',
      // Filler
      'Honestly', 'Personally', 'Definitely', 'Probably', 'Basically',
      'Second', 'Third', 'First', 'Another', 'Also', 'Just', 'Only',
    ]);
    if (!skipWords.has(candidate.split(' ')[0])) {
      return candidate;
    }
  }

  return null;
}

/**
 * Scrape Reddit for restaurant mentions in a given city and query.
 * For recommendation-request posts, also extracts names from comments.
 */
export async function scrapeRedditForRestaurants(
  city: string,
  query: string
): Promise<ExtractedRestaurant[]> {
  const subreddits = getSubreddits(city);
  const token = await getAccessToken();
  const results: ExtractedRestaurant[] = [];
  const seen = new Set<string>();

  await Promise.all(
    subreddits.map(async (subreddit) => {
      const posts = await fetchSubredditPosts(subreddit, query);

      for (const post of posts) {
        // Skip posts that aren't actually about the search query
        if (!isPostRelevantToQuery(post, query)) continue;

        // For recommendation-request posts, mine the comments for restaurant names
        if (isRecommendationRequest(post.title)) {
          const comments = await fetchPostComments(subreddit, post.id, token);
          for (const comment of comments) {
            const name = extractRestaurantName(comment);
            if (!name || !isValidRestaurantName(name)) continue;
            const key = name.toLowerCase();
            if (seen.has(key)) continue;
            seen.add(key);
            pushIfValid(results, {
              name,
              postUrl: post.permalink,
              summary: extractRelevantSentences(comment, name),
              source: `r/${post.subreddit}`,
              redditScore: post.score,
            });
          }
        } else {
          // Direct review/mention post — extract from title
          const name = extractRestaurantName(post.title);
          if (!name || !isValidRestaurantName(name)) continue;
          const key = name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          pushIfValid(results, {
            name,
            postUrl: post.permalink,
            summary: buildSummary(post),
            source: `r/${post.subreddit}`,
            redditScore: post.score,
          });
        }
      }
    })
  );

  return results.sort((a, b) => b.redditScore - a.redditScore);
}

export interface CommunityPick {
  postUrl: string;
  summary: string;
  source: string;
  redditScore: number;
}

/**
 * Search Reddit specifically for a validated restaurant name and return
 * posts/comments about it as community picks.
 */
export async function fetchCommunityPicksForRestaurant(
  city: string,
  restaurantName: string
): Promise<CommunityPick[]> {
  const subreddits = getSubreddits(city);
  const token = await getAccessToken();
  const picks: CommunityPick[] = [];
  const seenUrls = new Set<string>();

  await Promise.all(
    subreddits.map(async (subreddit) => {
      const posts = await fetchSubredditPosts(subreddit, restaurantName);

      for (const post of posts) {
        // Only use posts that actually mention this restaurant
        const haystack = `${post.title} ${post.selftext}`.toLowerCase();
        if (!haystack.includes(restaurantName.toLowerCase())) continue;
        if (seenUrls.has(post.permalink)) continue;
        seenUrls.add(post.permalink);

        if (isRecommendationRequest(post.title)) {
          // Mine comments for mentions of this restaurant
          const comments = await fetchPostComments(subreddit, post.id, token);
          for (const comment of comments) {
            if (!comment.toLowerCase().includes(restaurantName.toLowerCase())) continue;
            picks.push({
              postUrl: post.permalink,
              summary: extractRelevantSentences(comment, restaurantName),
              source: `r/${post.subreddit}`,
              redditScore: post.score,
            });
          }
        } else {
          // Direct post about the restaurant
          picks.push({
            postUrl: post.permalink,
            summary: buildSummary(post),
            source: `r/${post.subreddit}`,
            redditScore: post.score,
          });
        }
      }
    })
  );

  return picks.sort((a, b) => b.redditScore - a.redditScore).slice(0, 5);
}

function buildSummary(post: RedditPost): string {
  const text = post.selftext?.trim();
  if (text && text.length > 20) {
    return text.length > 200 ? `${text.slice(0, 197)}...` : text;
  }
  return post.title.length > 200 ? `${post.title.slice(0, 197)}...` : post.title;
}

/**
 * Extract sentences from a comment that mention the restaurant name.
 * Falls back to the full comment (truncated) if no matching sentence is found.
 */
function extractRelevantSentences(comment: string, name: string): string {
  const sentences = comment.split(/(?<=[.!?])\s+/);
  const nameLower = name.toLowerCase();
  const relevant = sentences.filter((s) => s.toLowerCase().includes(nameLower));
  const text = relevant.length > 0 ? relevant.join(' ') : comment;
  return text.length > 200 ? `${text.slice(0, 197)}...` : text;
}
