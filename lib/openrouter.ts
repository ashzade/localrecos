const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const MODEL = 'google/gemini-2.0-flash-exp:free';

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
