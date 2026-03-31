const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'meta-llama/llama-3.2-3b-instruct:free';
const REDDIT_MODEL = 'meta-llama/llama-3.3-70b-instruct:free';

/**
 * Parse a natural-language restaurant query into city + search terms using Gemini Flash.
 * Falls back to regex if the API key is missing or the call fails.
 */
export async function parseQueryWithLLM(
  query: string
): Promise<{ city: string | null; terms: string }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return regexFallback(query);

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You extract the city and search intent from restaurant queries. ' +
              'Return only valid JSON with keys "city" (string or null) and "terms" (string). ' +
              'The city should be the city name only (e.g. "Ottawa", not "Ottawa, ON"). ' +
              'The terms should be the cuisine, vibe, or occasion — everything except the city.',
          },
          {
            role: 'user',
            content: `Query: "${query}"\nReturn JSON:`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 256,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[openrouter] request failed', response.status, await response.text());
      return regexFallback(query);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return regexFallback(query);

    const parsed = JSON.parse(content);
    const city = typeof parsed.city === 'string' ? parsed.city.trim() || null : null;
    const terms = typeof parsed.terms === 'string' ? parsed.terms.trim() : query;
    console.log(`[openrouter] parsed query="${query}" → city="${city}" terms="${terms}"`);
    return { city, terms };
  } catch (err) {
    console.error('[openrouter] parseQuery threw', err);
    return regexFallback(query);
  }
}

export interface RedditRecommendation {
  name: string;
  summary: string;
}

/**
 * Ask the LLM what Reddit says about restaurants matching the query.
 * Returns a list of restaurant names + community summaries.
 */
export async function getRedditRecommendations(
  query: string,
  city: string,
  terms: string
): Promise<RedditRecommendation[]> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return [];

  try {
    const response = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: REDDIT_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a local food expert with deep knowledge of Reddit food communities. ' +
              'Return a JSON object with key "restaurants" containing an array of objects, ' +
              'each with "name" (exact restaurant name as it appears on Google Maps) and ' +
              '"summary" (1-2 sentences explaining what Reddit users say about it). ' +
              'Only include restaurants you are confident exist in the specified city. ' +
              'Return 4-8 restaurants. Do not include any thinking or explanation outside the JSON.',
          },
          {
            role: 'user',
            content: `According to Reddit, what are the best ${terms} in ${city}? (original search: "${query}")`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 1024,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('[openrouter] reddit-llm failed', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    let content: string = data.choices?.[0]?.message?.content ?? '';
    if (!content) return [];

    // Strip <think>...</think> blocks that some Qwen models emit
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    const parsed = JSON.parse(content);
    const list = parsed.restaurants;
    if (!Array.isArray(list)) return [];

    return list
      .filter((r: unknown) => r && typeof (r as Record<string, unknown>).name === 'string' && typeof (r as Record<string, unknown>).summary === 'string')
      .map((r: Record<string, unknown>) => ({
        name: (r.name as string).trim(),
        summary: (r.summary as string).trim(),
      }));
  } catch (err) {
    console.error('[openrouter] getRedditRecommendations threw', err);
    return [];
  }
}

function regexFallback(query: string): { city: string | null; terms: string } {
  const trimmed = query.trim();
  const match = trimmed.match(/\b(?:in|near)\s+([A-Z][a-zA-Z\s]+?)(?:\s*$|\s+(?:area|canada|usa|us|uk))/i);
  if (match) {
    const city = match[1].trim();
    const terms = trimmed.replace(match[0], '').trim().replace(/\s+/g, ' ');
    return { city, terms: terms || trimmed };
  }
  return { city: null, terms: trimmed };
}
