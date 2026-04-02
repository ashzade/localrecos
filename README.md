# localrecos — Find great local restaurants recommended by real people in your community

Tired of generic "top 10" lists that feel like ads? localrecos finds restaurants that actual people are talking about and recommending in online communities. Type in what you're looking for — like "cozy ramen spots in Austin" — and get back real suggestions backed by community discussion, complete with addresses, hours, and photos.

## Features

- **Search in plain English** — just describe what you want and where, no filters or dropdowns required
- **Results from real community discussions** — recommendations are pulled from genuine online conversations, not curated marketing lists
- **Only real restaurants** — every result is cross-checked against a restaurant database, so you won't see parks, shops, or anything that isn't actually a place to eat
- **Rich details for each spot** — see the address, opening hours, price range, photos, and contact info all in one place
- **Community voting** — upvote or downvote restaurants and individual recommendations so the best spots rise to the top
- **Fallback suggestions** — if community discussions don't turn up results for your search, the app still does its best to surface relevant options
- **How often a place gets mentioned** — see whether a restaurant was a one-off mention or something people keep bringing up

## Getting started

Before running the app, you'll need to set the following environment variables:

1. **`REDDIT_CLIENT_ID`** — your Reddit app client ID (used to search community discussions)
2. **`REDDIT_CLIENT_SECRET`** — your Reddit app client secret
3. **`REDDIT_USER_AGENT`** — a name to identify your app when talking to Reddit (e.g. `localrecos/1.0`)
4. **`GOOGLE_PLACES_API_KEY`** — your Google Places API key (used to look up and verify restaurant details)
5. **`OPENROUTER_API_KEY`** — your OpenRouter API key (used to understand your natural-language search)
6. **`DEFAULT_CITY`** *(optional)* — a fallback city to use when no city is included in a search query (e.g. `Chicago`)

Once those are in place, install the dependencies and start the app according to your platform's usual setup steps.