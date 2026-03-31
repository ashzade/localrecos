# localrecos

**Ask a question in plain English, get real restaurant recommendations from your local community.**

Finding trustworthy restaurant recommendations online usually means digging through endless review sites or scrolling Reddit for hours. localrecos does that work for you — it searches real community discussions, pulls out the restaurants people are actually talking about, and hands you a clean, ranked list with all the details you need. It's built for anyone who wants honest, crowd-sourced picks without the hassle.

## Features

- **Search in plain English** — type something like "best tacos in Austin" or "cheap date night spots near downtown" and get results
- **Community-sourced results** — recommendations come from real Reddit discussions, not sponsored listings
- **Rich restaurant details** — each result includes address, phone number, website, opening hours, price range, and photos where available
- **Community voting** — upvote or downvote restaurants and individual recommendations to help surface the best ones
- **Retry on failure** — if a search doesn't go through, you can try again without starting over

## Getting started

Before running localrecos, you'll need to set up a few things:

1. **Google Places API key** — this lets the app fetch details like addresses, hours, and photos for each restaurant. Set the environment variable:
   ```
   GOOGLE_PLACES_API_KEY=your_key_here
   ```

2. **OpenRouter API key** — this powers the natural language understanding so the app can make sense of your search. Set the environment variable:
   ```
   OPENROUTER_API_KEY=your_key_here
   ```

3. **Default city (optional)** — if you want searches to fall back to a specific city when none is mentioned, set:
   ```
   DEFAULT_CITY=your_city_here
   ```

Once those are in place, start the app and enter your search — localrecos will handle the rest.