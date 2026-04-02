# localrecos — Find great local restaurants recommended by real people in your community

Tired of generic "best restaurants" lists that feel like ads? localrecos finds places that actual people are raving about online. It reads real community discussions, pulls out the restaurants people mention most, and gives you useful details like hours, address, and photos — all from one simple search.

## Features

- **Search in plain English** — type something like "best tacos in Austin" and get real results
- **Powered by real community conversations** — recommendations come from genuine online discussions, not paid placements
- **Verified real restaurants only** — every result is cross-checked to make sure it's an actual food venue before it's shown to you
- **Rich details for every spot** — see the address, opening hours, price range, website, and a photo for each recommendation
- **Community voting** — upvote or downvote restaurants and individual recommendations to help others find the best spots
- **Automatic fallback** — if community discussions don't turn up results, the app still finds you solid suggestions
- **City-aware results** — searches are always tied to a specific city so you never get recommendations from the wrong place

## Getting started

Before running localrecos, you'll need to set up a few accounts and add your credentials as environment variables:

1. **Reddit API credentials** — create an app at [reddit.com/prefs/apps](https://www.reddit.com/prefs/apps) to get your credentials:
   - `REDDIT_CLIENT_ID`
   - `REDDIT_CLIENT_SECRET`
   - `REDDIT_USER_AGENT` (a short name identifying your app, e.g. `localrecos/1.0`)

2. **Google Places API key** — get a key from the [Google Cloud Console](https://console.cloud.google.com/) with the Places API enabled:
   - `GOOGLE_PLACES_API_KEY`

3. **OpenRouter API key** — sign up at [openrouter.ai](https://openrouter.ai) to get your key:
   - `OPENROUTER_API_KEY`

4. **Default city (optional)** — if you want a fallback city to be used when no city is included in a search:
   - `DEFAULT_CITY` (e.g. `DEFAULT_CITY=Chicago`)

Once your environment variables are in place, install dependencies and start the app according to the instructions in your local setup.