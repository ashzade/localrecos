---
feature_id: restaurant_recommendations
version: 1.0.0
status: draft
owner: platform-team
depends_on:
  - foursquare_api
  - google_places_api
  - reddit_api
tags:
  - recommendations
  - restaurants
  - search
---

# Restaurant Recommendations

Accepts natural-language queries, fetches Reddit community discussions, extracts restaurant mentions, enriches them with place details from Foursquare and Google Places, and returns ranked recommendations.

## External State Providers

### FoursquareAPI
source: foursquare-api
provides: venue details and ratings for restaurants
lookup_key: place_name
Methods:
  - search(name: string, city: string): json
  - getDetails(venue_id: string): json

### GooglePlacesAPI
source: google-places-api
provides: place details, hours, and photos for restaurants
lookup_key: place_id
Methods:
  - findPlace(name: string, city: string): json
  - getDetails(place_id: string): json

### RedditAPI
source: reddit-api
provides: community posts and comments mentioning restaurants
lookup_key: query
Methods:
  - search(query: string, subreddit: string): json
  - getPost(post_id: string): json

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
Trigger: query submitted by user
Guard: RULE_01
Action: emit_event(QUERY_RECEIVED), set_field(entity.status, 'fetching')

#### FETCHING → EXTRACTING
Trigger: Reddit posts retrieved successfully
Guard: RULE_02
Action: emit_event(POSTS_FETCHED), set_field(entity.status, 'extracting')

#### FETCHING → FAILED
Trigger: Reddit fetch raises an exception
Action: emit_event(FETCH_FAILED), set_field(entity.status, 'failed')

#### EXTRACTING → ENRICHING
Trigger: restaurant names extracted from posts
Guard: RULE_03
Action: emit_event(EXTRACTION_COMPLETE), set_field(entity.status, 'enriching')

#### EXTRACTING → FAILED
Trigger: extraction yields no results
Action: emit_event(EXTRACTION_FAILED), set_field(entity.status, 'failed')

#### ENRICHING → COMPLETE
Trigger: place details fetched for all extracted restaurants
Action: emit_event(ENRICHMENT_COMPLETE), set_field(entity.status, 'complete')

#### ENRICHING → FAILED
Trigger: enrichment raises an unrecoverable exception
Action: emit_event(ENRICHMENT_FAILED), set_field(entity.status, 'failed')

#### FAILED → PENDING
Trigger: retry requested by user
Action: set_field(entity.status, 'pending')

## Actors & Access

### SystemPipeline
Read: parsed_queries, reddit_posts, extracted_restaurants, place_details, place_details_raw
Write: parsed_queries, reddit_posts, extracted_restaurants, place_details, place_details_raw, restaurants_with_recommendations

### PublicAPI
Read: restaurants_with_recommendations, parsed_queries
Write: parsed_queries

### Logic Enforcement

RULE_01: HIGH → reject
RULE_02: MEDIUM → reject
RULE_03: MEDIUM → reject
RULE_04: LOW → audit_log
RULE_05: HIGH → reject
RULE_06: LOW → audit_log

## Data Model

### ParsedQuery

id:             string | primary | auto-gen
raw_query:      string | required
city:           string | required | default(env(DEFAULT_CITY))
cuisine_type:   string | nullable
keywords:       string | required | default([])
status:         enum('pending', 'fetching', 'extracting', 'enriching', 'complete', 'failed') | required | default(pending)
created_at:     timestamp | auto-gen
updated_at:     timestamp | auto-gen

### RedditPost

id:             string | primary | auto-gen
query_id:       string | required | indexed | fk(ParsedQuery.id, many-to-one)
post_id:        string | unique | required | indexed
title:          string | required
body:           string | nullable
subreddit:      string | required
author:         string | nullable
score:          integer | required | default(0)
comment_count:  integer | required | default(0)
url:            string | required
fetched_at:     timestamp | auto-gen

### ExtractedRestaurant

id:             string | primary | auto-gen
post_id:        string | required | indexed | fk(RedditPost.id, many-to-one)
query_id:       string | required | indexed | fk(ParsedQuery.id, many-to-one)
name:           string | required
mention_count:  integer | required | default(1)
context_snippet: string | nullable
city:           string | required
created_at:     timestamp | auto-gen

### PlaceDetailsRaw

id:             string | primary | auto-gen
extracted_restaurant_id: string | required | indexed | fk(ExtractedRestaurant.id, one-to-one)
foursquare_raw: string | nullable
google_raw:     string | nullable
fetched_at:     timestamp | auto-gen

### PlaceDetails

id:             string | primary | auto-gen
extracted_restaurant_id: string | required | unique | indexed | fk(ExtractedRestaurant.id, one-to-one)
name:           string | required
address:        string | nullable
city:           string | required
phone:          string | nullable
website:        string | nullable
hours:          string | nullable
price_level:    integer | nullable
rating:         decimal | nullable
review_count:   integer | nullable
photo_url:      string | nullable
foursquare_id:  string | nullable
google_place_id: string | nullable
created_at:     timestamp | auto-gen

### RestaurantWithRecommendations

id:             string | primary | auto-gen
query_id:       string | required | indexed | fk(ParsedQuery.id, many-to-one)
place_details_id: string | required | indexed | fk(PlaceDetails.id, many-to-one)
recommendation_score: decimal | required | default(0)
mention_count:  integer | required | default(0)
reddit_score:   integer | required | default(0)
summary:        string | nullable
created_at:     timestamp | auto-gen

## Computed Properties

### has_place_data
Aggregate: EXISTS
Entity: PlaceDetails
Filter: entity.foursquare_id != '' OR entity.google_place_id != ''
Window: none

### high_confidence_recommendations
Aggregate: COUNT
Entity: RestaurantWithRecommendations
Filter: entity.recommendation_score > 0.7 AND entity.mention_count > 1
Window: none

### top_mentioned_restaurants
Aggregate: COUNT
Entity: ExtractedRestaurant
Filter: entity.mention_count > 2
Window: none

## Logic Rules

### Validation Rules

#### RULE_01: Query Must Be Non-Empty
Type: Validation
Entity: ParsedQuery
Condition: entity.raw_query != '' AND entity.city != ''
Message: Query text and city are required to begin restaurant search.

#### RULE_02: Reddit Posts Must Be Present Before Extraction
Type: Validation
Entity: RedditPost
Condition: entity.post_id != '' AND entity.title != ''
Message: Reddit post is missing required fields; cannot extract restaurants.

#### RULE_03: Extracted Restaurant Must Have a Name
Type: Validation
Entity: ExtractedRestaurant
Condition: entity.name != '' AND entity.city != ''
Message: Extracted restaurant must have a name and city to proceed with enrichment.

### Business Rules

#### RULE_04: Skip Enrichment When Place Data Already Exists
Type: Business
Entity: ExtractedRestaurant
Condition: has_place_data == true
Message: Place details already fetched for this restaurant; skipping enrichment.

#### RULE_05: API Keys Required for Enrichment
Type: Business
Entity: ExtractedRestaurant
Condition: env(FOURSQUARE_API_KEY) != '' OR env(GOOGLE_PLACES_API_KEY) != ''
Message: At least one place enrichment API key must be configured; cannot enrich restaurant details.

#### RULE_06: Default City Fallback Required
Type: Business
Entity: ParsedQuery
Condition: entity.city != '' OR env(DEFAULT_CITY) != ''
Message: No city provided and DEFAULT_CITY environment variable is not set; cannot resolve location.