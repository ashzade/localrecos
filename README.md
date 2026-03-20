# LocalRecos

A community-driven restaurant discovery platform that surfaces recommendations from Reddit and other local community discussions. Search using natural language (e.g., "most authentic Indian in Ottawa") and get real recommendations from people who live there.

## What It Does

- **Natural language search** — parse queries like "best ramen near me" or "cheap tacos in Montreal"
- **Community-sourced results** — scrapes Reddit (r/ottawa, r/ottawafoodies, etc.) for authentic local recommendations
- **Google Maps integration** — enriches results with address, phone, hours, photos, and price range
- **Community voting** — upvote/downvote restaurants and individual recommendations
- **Trending section** — top-voted restaurants for your detected city
- **IP-based city detection** — automatically suggests your city on load

## Tech Stack

- **Next.js 14** (App Router) + **React 18** + **TypeScript**
- **Tailwind CSS** with a custom orange brand palette
- **Prisma** ORM + **PostgreSQL**
- **Google Places API** — restaurant details
- **Reddit API** — community recommendation scraping
- **ip-api.com** — free IP geolocation (no key required)

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- Google Places API key
- Reddit API credentials

### Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/localrecos
GOOGLE_PLACES_API_KEY=your_key_here
REDDIT_USER_AGENT=LocalRecos/1.0
```

```bash
# Generate Prisma client and sync schema
npm run db:generate
npm run db:push
```

### Running

```bash
# Development (http://localhost:3000)
npm run dev

# Production
npm run build
npm start
```

### Database

```bash
npm run db:generate   # Regenerate Prisma client after schema changes
npm run db:push       # Push schema changes (no migration files)
npm run db:migrate    # Create and run migrations
npm run db:studio     # Open Prisma Studio GUI
```

## Project Structure

```
app/
├── page.tsx                  # Homepage with search + trending
├── search/page.tsx           # Search results with sort/filter
├── restaurant/[id]/page.tsx  # Restaurant detail page
└── api/
    ├── search/               # Search + background scraping trigger
    ├── trending/             # Top restaurants by net votes
    ├── vote/                 # Vote on community recommendations
    ├── restaurant-vote/      # Vote on restaurants
    ├── scrape/               # Reddit scraping job
    └── geo/                  # IP geolocation

components/
├── SearchBar.tsx             # Natural language input + city detection
├── RestaurantCard.tsx        # List card with votes + rec preview
├── RecommendationCard.tsx    # Individual Reddit snippet with voting
├── TrendingSection.tsx       # Top 10 trending widget
├── VoteButton.tsx            # Upvote/downvote UI
└── SortBar.tsx               # Sort by votes or price range

lib/
├── search.ts                 # Query parsing + restaurant lookup
├── google-places.ts          # Google Places API client
├── reddit.ts                 # Reddit scraping logic
├── geo.ts                    # IP geolocation
├── fingerprint.ts            # Browser fingerprint for vote deduplication
└── db.ts                     # Prisma client singleton

prisma/
└── schema.prisma             # Restaurant, CommunityRecommendation, Vote, RestaurantVote
```

## Data Model

| Model | Key Fields |
|---|---|
| `Restaurant` | name, city, address, hours, price_range, status (`UNREVIEWED` / `VERIFIED` / `INCOMPLETE`), upvotes, downvotes |
| `CommunityRecommendation` | source URL, post excerpt, mention_count, sentiment_summary |
| `Vote` | recommendation vote, unique per fingerprint + recommendation |
| `RestaurantVote` | restaurant vote, unique per fingerprint + restaurant |

## License

MIT
