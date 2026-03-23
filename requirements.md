---
feature_id: restaurant_recommendations
version: 1.0.0
status: draft
owner: platform-team
depends_on:
  - google_places_api
  - openrouter_api
tags:
  - recommendations
  - restaurants
  - search
---

# Restaurant Recommendations

Accepts natural-language queries, fetches Reddit community discussions, extracts restaurant mentions, enriches them with place details from Google Places, and returns ranked recommendations.

## External State Providers

### GooglePlacesAPI
> Used for: place details, hours, and photos for restaurants.

source: google-places-api
provides: place details, hours, and photos for restaurants
lookup_key: place_id
Methods:
  - searchText(query: string, city: string): json

### OpenRouterAPI
> Used for: LLM-powered natural language query parsing via Gemini Flash.

source: openrouter-api
provides: LLM-powered natural language query parsing via Gemini Flash
lookup_key: query
Methods:
  - parseQuery(query: string): json

## State Machine

### States

- PENDING – query received, Reddit fetch not yet attempted
- FETCHING – Reddit posts are being retrieved and parsed
- EXTRACTING – restaurant names are being extracted from posts
- ENRICHING – place details are being fetched from external APIs
- COMPLETE – all enrichment succeeded and recommendations are ready
- FAILED – one or more unrecoverable errors occurred during processing

### Transitions

#### PENDING → FETCHING
> Query submitted by user.

Trigger: query submitted by user
Guard: RULE_01
Action: emit_event(QUERY_RECEIVED), set_field(entity.status, 'fetching')

#### FETCHING → EXTRACTING
> Reddit posts retrieved successfully.

Trigger: Reddit posts retrieved successfully
Guard: RULE_02
Action: emit_event(POSTS_FETCHED), set_field(entity.status, 'extracting')

#### FETCHING → FAILED
> Reddit fetch raises an exception.

Trigger: Reddit fetch raises an exception
Action: emit_event(FETCH_FAILED), set_field(entity.status, 'failed')

#### EXTRACTING → ENRICHING
> Restaurant names extracted from posts.

Trigger: restaurant names extracted from posts
Guard: RULE_03
Action: emit_event(EXTRACTION_COMPLETE), set_field(entity.status, 'enriching')

#### EXTRACTING → FAILED
> Extraction yields no results.

Trigger: extraction yields no results
Action: emit_event(EXTRACTION_FAILED), set_field(entity.status, 'failed')

#### ENRICHING → COMPLETE
> Place details fetched for all extracted restaurants.

Trigger: place details fetched for all extracted restaurants
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
RULE_04: LOW → audit_log
RULE_05: HIGH → reject
RULE_06: LOW → audit_log

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

#### RULE_04: Skip Enrichment When Place Data Already Exists
> Place details already fetched for this restaurant; skipping enrichment.

Type: Business
Entity: ExtractedRestaurant
Condition: has_place_data == true
Message: Place details already fetched for this restaurant; skipping enrichment.

#### RULE_05: API Keys Required for Enrichment
> Google Places API key must be configured; cannot enrich restaurant details.

Scope: scrape
> Google Places API key must be configured; cannot enrich restaurant details.

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