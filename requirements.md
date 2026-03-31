---
feature_id: restaurant_recommendations
version: 1.1.0
status: draft
owner: platform-team
depends_on:
  - reddit_api
  - google_places_api
  - openrouter_api
tags:
  - recommendations
  - restaurants
  - search
---

# Restaurant Recommendations

Accepts natural-language queries, searches real Reddit community discussions using the Reddit OAuth API, extracts restaurant names from posts and comments, validates each result against Google Places (food venues only), enriches with address/hours/photos, and returns ranked recommendations backed by community votes.

## External State Providers

### RedditAPI
> Used for: searching subreddit posts and comments for real restaurant recommendations.

source: reddit-oauth-api
provides: real community Reddit posts and comments about local restaurants
lookup_key: subreddit + query
env:
  - REDDIT_CLIENT_ID
  - REDDIT_CLIENT_SECRET
  - REDDIT_USER_AGENT
Methods:
  - searchPosts(subreddit: string, query: string, sort: 'relevance'): RedditPost[]
  - getComments(subreddit: string, postId: string): string[]

### GooglePlacesAPI
> Used for: validating extracted restaurant names and enriching with place details, hours, and photos. Only food-type venues (restaurant, cafe, bar, etc.) are accepted — any result with a non-food primaryType is rejected.

source: google-places-api
provides: place details, hours, and photos for restaurants
lookup_key: place_id
env:
  - GOOGLE_PLACES_API_KEY
Methods:
  - searchText(query: string, city: string): json

### OpenRouterAPI
> Used for: LLM-powered natural language query parsing (city + search terms extraction) and as a fallback recommendation source when Reddit returns no results.

source: openrouter-api
provides: LLM-powered natural language query parsing (free-tier llama models)
lookup_key: query
env:
  - OPENROUTER_API_KEY
Methods:
  - parseQuery(query: string): json
  - getRedditRecommendations(query: string, city: string, terms: string): json

## State Machine

### States

- PENDING – query received, scrape not yet triggered
- PARSING – LLM is extracting city and search terms from the raw query
- FETCHING – Reddit OAuth API is being searched for relevant posts and comments
- FALLBACK – Reddit returned no results; LLM is generating restaurant candidates instead
- EXTRACTING – restaurant names are being extracted from Reddit posts/comments
- VALIDATING – each extracted name is being checked against Google Places (food venues only)
- ENRICHING – confirmed food venues are being enriched with address, hours, and photos
- COMPLETE – all enrichment succeeded and recommendations are persisted and ready
- FAILED – one or more unrecoverable errors occurred during processing

### Transitions

#### PENDING → PARSING
> Query submitted by user.

Trigger: query submitted by user
Guard: RULE_01
Action: emit_event(QUERY_RECEIVED), set_field(entity.status, 'parsing')

#### PARSING → FETCHING
> LLM parsed city and search terms successfully.

Trigger: city and terms extracted from query
Guard: RULE_06
Action: emit_event(QUERY_PARSED), set_field(entity.status, 'fetching')

#### FETCHING → EXTRACTING
> Reddit OAuth search returned food-relevant posts.

Trigger: Reddit posts retrieved and food-filtered successfully
Guard: RULE_02
Action: emit_event(POSTS_FETCHED), set_field(entity.status, 'extracting')

#### FETCHING → FALLBACK
> Reddit returned no food-relevant results for this city/query.

Trigger: Reddit search returns zero food-relevant posts
Action: emit_event(REDDIT_EMPTY), set_field(entity.status, 'fallback')

#### FALLBACK → EXTRACTING
> LLM generated restaurant candidates to use instead of Reddit.

Trigger: LLM fallback returns restaurant list
Action: emit_event(FALLBACK_COMPLETE), set_field(entity.status, 'extracting')

#### FALLBACK → FAILED
> LLM fallback also returns no results.

Trigger: LLM fallback returns empty list
Action: emit_event(FALLBACK_FAILED), set_field(entity.status, 'failed')

#### EXTRACTING → VALIDATING
> Restaurant names extracted from posts or comments.

Trigger: restaurant names extracted
Guard: RULE_03
Action: emit_event(EXTRACTION_COMPLETE), set_field(entity.status, 'validating')

#### EXTRACTING → FAILED
> Extraction yields no valid restaurant names.

Trigger: extraction yields no results after filtering
Action: emit_event(EXTRACTION_FAILED), set_field(entity.status, 'failed')

#### VALIDATING → ENRICHING
> Google Places confirmed at least one result as a real food venue.

Trigger: one or more names confirmed as food venues by Google Places
Action: emit_event(VALIDATION_COMPLETE), set_field(entity.status, 'enriching')

#### VALIDATING → FAILED
> Google Places found no food venues for any extracted name.

Trigger: all extracted names rejected by Google Places type filter
Action: emit_event(VALIDATION_FAILED), set_field(entity.status, 'failed')

#### ENRICHING → COMPLETE
> Place details persisted for all validated restaurants.

Trigger: restaurants and community recommendations upserted to database
Action: emit_event(ENRICHMENT_COMPLETE), set_field(entity.status, 'complete')

#### ENRICHING → FAILED
> Enrichment raises an unrecoverable exception.

Trigger: enrichment raises an unrecoverable exception
Action: emit_event(ENRICHMENT_FAILED), set_field(entity.status, 'failed')

#### FAILED → PENDING
> Retry requested by user.

Trigger: retry requested by user
Action: set_field(entity.status, 'pending')

## Actors & Access

### SystemPipeline
Read: restaurants, community_recommendations
Write: restaurants, community_recommendations

### PublicAPI
Read: restaurants, community_recommendations
Write: restaurant_votes, votes

### Logic Enforcement

RULE_01: HIGH → reject
RULE_02: MEDIUM → reject
RULE_03: MEDIUM → reject
RULE_05: HIGH → reject
RULE_06: LOW → audit_log
RULE_07: MEDIUM → reject

## Data Model

Note: ParsedQuery, RedditPost, ExtractedRestaurant, and PlaceDetails are in-memory TypeScript interfaces used during the scraping pipeline. Restaurant, CommunityRecommendation, RestaurantVote, and Vote are persisted to the database.

### ParsedQuery (in-memory)
> Temporary data used during processing — not saved to the database.

city:           string | nullable
terms:          string | required
raw:            string | required

### RedditPost (in-memory)
> Temporary data used during processing — not saved to the database.

id:             string | required
title:          string | required
selftext:       string | required
url:            string | required
permalink:      string | required
subreddit:      string | required
score:          integer | required
created_utc:    integer | required

### ExtractedRestaurant (in-memory)
> Temporary data used during processing — not saved to the database.

name:           string | required
postUrl:        string | required
summary:        string | required
source:         string | required
redditScore:    integer | required

### PlaceDetails (in-memory)
> Temporary data used during processing — not saved to the database.

name:           string | required
address:        string | nullable
phone:          string | nullable
website:        string | nullable
hours:          string | nullable
price_range:    string | nullable
service_options: string[] | required
photo_url:      string | nullable

### Restaurant
> Saved to the database.

id:             string | primary | auto-gen
name:           string | required | indexed
city:           string | required | indexed
address:        string | nullable
phone:          string | nullable
website:        string | nullable
hours:          string | nullable
price_range:    string | nullable
service_options: string[] | required | default([])
status:         enum('UNREVIEWED', 'VERIFIED') | required | default(UNREVIEWED)
photo_url:      string | nullable
upvotes:        integer | required | default(0)
downvotes:      integer | required | default(0)
created_at:     timestamp | auto-gen
updated_at:     timestamp | auto-gen

### CommunityRecommendation
> Saved to the database.

id:             string | primary | auto-gen
restaurant_id:  string | required | indexed | fk(Restaurant.id, many-to-one)
source:         string | required
post_url:       string | required
summary:        string | required
mention_count:  integer | required | default(1)
source_upvotes: integer | required | default(0)
upvotes:        integer | required | default(0)
downvotes:      integer | required | default(0)
scraped_at:     timestamp | auto-gen

### RestaurantVote
> Saved to the database.

id:             string | primary | auto-gen
restaurant_id:  string | required | indexed | fk(Restaurant.id, many-to-one)
fingerprint:    string | required | indexed
direction:      enum('up', 'down') | required
created_at:     timestamp | auto-gen

### Vote
> Saved to the database.

id:             string | primary | auto-gen
recommendation_id: string | required | indexed | fk(CommunityRecommendation.id, many-to-one)
fingerprint:    string | required | indexed
direction:      enum('up', 'down') | required
created_at:     timestamp | auto-gen

## Computed Properties

### has_place_data
Aggregate: EXISTS
Entity: Restaurant
Filter: entity.address != '' OR entity.phone != '' OR entity.website != ''
Window: none

### high_net_vote_restaurants
Aggregate: COUNT
Entity: Restaurant
Filter: entity.upvotes - entity.downvotes > 2
Window: none

### top_mentioned_restaurants
Aggregate: COUNT
Entity: CommunityRecommendation
Filter: entity.mention_count > 2
Window: none

## Logic Rules

### Validation Rules

#### RULE_01: Query Must Be Non-Empty
> Query text and city are required to begin restaurant search.

Scope: api/search, scrape
> Query text and city are required to begin restaurant search.

Type: Validation
Entity: ParsedQuery
Condition: entity.raw_query != '' AND entity.city != ''
Message: Query text and city are required to begin restaurant search.

#### RULE_02: Reddit Posts Must Be Present Before Extraction
> Reddit post is missing required fields; cannot extract restaurants.

Type: Validation
Entity: RedditPost
Condition: entity.post_id != '' AND entity.title != ''
Message: Reddit post is missing required fields; cannot extract restaurants.

#### RULE_03: Extracted Restaurant Must Have a Name
> Extracted restaurant must have a name and city to proceed with enrichment.

Scope: scrape
> Extracted restaurant must have a name and city to proceed with enrichment.

Type: Validation
Entity: ExtractedRestaurant
Condition: entity.name != '' AND entity.city != ''
Message: Extracted restaurant must have a name and city to proceed with enrichment.

### Business Rules


#### RULE_05: API Keys Required for Enrichment
> Google Places API key must be configured when enrichment is needed; only applies when place data does not already exist (i.e. RULE_04 condition is false).

Scope: scrape

Type: Business
Entity: ExtractedRestaurant
Condition: env(GOOGLE_PLACES_API_KEY) != ''
Message: Google Places API key must be configured; cannot enrich restaurant details.

#### RULE_06: Default City Fallback Required
> No city provided and DEFAULT_CITY environment variable is not set; cannot resolve location.

Scope: api/search, scrape
> No city provided and DEFAULT_CITY environment variable is not set; cannot resolve location.

Type: Business
Entity: ParsedQuery
Condition: entity.city != '' OR env(DEFAULT_CITY) != ''
Message: No city provided and DEFAULT_CITY environment variable is not set; cannot resolve location.

#### RULE_07: Google Places Must Confirm Food Venue
> Extracted restaurant name must resolve to a food-type venue in Google Places; non-food venues (parks, historic sites, moving companies, etc.) are rejected.

Scope: scrape

Type: Business
Entity: ExtractedRestaurant
Condition: entity.google_places_primary_type != '' AND entity.name != ''
Message: Google Places returned a non-food venue for this name; skipping.