# localrecos

**Find great local restaurants by searching real community conversations — just describe what you're looking for.**

Tired of scrolling through generic review sites? localrecos lets you search for restaurants the way you'd ask a friend — in plain English. It finds what real people are saying about local spots across online communities, pulls together all the useful details, and hands you a ranked list you can actually trust. It's perfect for anyone who wants honest, community-backed recommendations without the noise.

## Features

- **Search in plain English** — type something like "cozy ramen spots open late" and get real results
- **Powered by real community discussions** — recommendations come from what people are genuinely talking about online, not paid placements
- **Full restaurant details in one place** — see address, phone number, website, hours, price range, and available services for each result
- **Community voting** — upvote or downvote restaurants and individual recommendations to help surface the best options
- **Ranked results** — restaurants are sorted based on how often they're mentioned and how well the community rates them
- **Retry on failure** — if something goes wrong with a search, you can simply try again without starting over

## Getting started

Before running localrecos, you'll need to set up a few things:

1. **Get a Google Places API key** — this is used to fetch restaurant details like hours and photos. Set it as an environment variable:
   ```
   GOOGLE_PLACES_API_KEY=your_key_here
   ```

2. **Get an OpenRouter API key** — this powers the natural language understanding behind your searches. Set it as:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```

3. **Set a default city (optional but recommended)** — if you want searches to fall back to a specific city when none is mentioned, set:
   ```
   DEFAULT_CITY=San Francisco
   ```

Once your environment variables are in place, start the app and enter a search query to get your first recommendations.