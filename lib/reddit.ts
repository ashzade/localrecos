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
  // Default: try city name as subreddit plus city+food
  const slug = key.replace(/\s+/g, '');
  return [slug, `${slug}food`];
}

const USER_AGENT = process.env.REDDIT_USER_AGENT || 'LocalRecos/1.0';

async function fetchSubredditPosts(
  subreddit: string,
  query: string
): Promise<RedditPost[]> {
  const encodedQuery = encodeURIComponent(query);
  const url = `https://www.reddit.com/r/${subreddit}/search.json?q=${encodedQuery}&sort=top&t=year&limit=25&restrict_sr=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': USER_AGENT,
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) return [];

    const data = await response.json();
    const posts: RedditPost[] = [];

    if (data?.data?.children) {
      for (const child of data.data.children) {
        const post = child.data;
        if (post && post.title) {
          posts.push({
            id: post.id,
            title: post.title,
            selftext: post.selftext || '',
            url: post.url,
            permalink: `https://www.reddit.com${post.permalink}`,
            subreddit: post.subreddit,
            score: post.score || 0,
            created_utc: post.created_utc || 0,
          });
        }
      }
    }

    return posts;
  } catch {
    return [];
  }
}

/**
 * Extract likely restaurant name from a Reddit post title.
 * Uses several heuristics in order of confidence.
 */
export function extractRestaurantName(title: string): string | null {
  // 1. Quoted text: "Restaurant Name" or 'Restaurant Name'
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
    // Skip common sentence-start words
    const skipWords = new Set([
      'Best', 'Top', 'Great', 'Good', 'Most', 'Any', 'What', 'Where',
      'Which', 'Looking', 'Need', 'Help', 'Recommendations', 'Anyone',
      'Does', 'Has', 'Are', 'Can', 'Should', 'Would', 'Could', 'New',
    ]);
    if (!skipWords.has(candidate.split(' ')[0])) {
      return candidate;
    }
  }

  return null;
}

/**
 * Scrape Reddit for restaurant mentions in a given city and query.
 * Returns a list of extracted restaurant candidates.
 */
export async function scrapeRedditForRestaurants(
  city: string,
  query: string
): Promise<ExtractedRestaurant[]> {
  const subreddits = getSubreddits(city);
  const results: ExtractedRestaurant[] = [];
  const seen = new Set<string>();

  await Promise.all(
    subreddits.map(async (subreddit) => {
      const posts = await fetchSubredditPosts(subreddit, query);

      for (const post of posts) {
        const restaurantName = extractRestaurantName(post.title);
        if (!restaurantName) continue;

        const key = restaurantName.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        const summary = buildSummary(post);

        results.push({
          name: restaurantName,
          postUrl: post.permalink,
          summary,
          source: `r/${post.subreddit}`,
          redditScore: post.score,
        });
      }
    })
  );

  // Sort by Reddit score descending
  return results.sort((a, b) => b.redditScore - a.redditScore);
}

function buildSummary(post: RedditPost): string {
  const text = post.selftext?.trim();
  if (text && text.length > 20) {
    // Take first 200 chars of body
    return text.length > 200 ? `${text.slice(0, 197)}...` : text;
  }
  // Fall back to title
  return post.title.length > 200 ? `${post.title.slice(0, 197)}...` : post.title;
}
