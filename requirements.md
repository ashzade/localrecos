---
feature_id: localrecos
version: 1.0.0
status: draft
owner: ashzade
tags:
  - restaurants
  - recommendations
  - community
  - search
---

# LocalRecos

A site where anonymous users search for restaurant recommendations using natural language (e.g. "most authentic Indian in Ottawa"). Results are sourced from community sites like Reddit subreddits (r/ottawa, r/ottawafoodies, and city-specific equivalents). Users can see trending restaurants in their detected city, filter results, vote on recommendations, and share individual restaurant links.

## External State Providers

### GooglePlaces
source: google-maps-api
provides: restaurant details including address, phone, hours, website, and photo
lookup_key: restaurant_name + city
Methods:
  - lookup(name: string, city: string): RestaurantDetails
  - verified(name: string, city: string): boolean

### RedditScraper
source: reddit-api
provides: community posts mentioning restaurants from city-specific subreddits
lookup_key: city
Methods:
  - fetch_mentions(city: string, subreddits: string[]): Post[]

### GeoDetector
source: browser-geolocation + ip-geolocation
provides: the user's current city
lookup_key: request_context
Methods:
  - detect_city(context: RequestContext): string | null

## State Machine

### States

- UNREVIEWED – restaurant scraped, no community votes recorded yet
- VERIFIED – restaurant has received at least one community vote
- INCOMPLETE – restaurant details could not be confirmed via Google Maps

### Transitions

#### UNREVIEWED → VERIFIED
Trigger: A vote is cast on any of the restaurant's community recommendations
Guard: RULE_01
Action: set_field(entity.status, 'VERIFIED')

#### UNREVIEWED → INCOMPLETE
Trigger: Google Maps lookup returns no result for the restaurant
Guard: RULE_02
Action: set_field(entity.details_verified, false)

#### INCOMPLETE → VERIFIED
Trigger: A vote is cast on any of the restaurant's community recommendations
Guard: RULE_01

## Actors & Access

### Visitor
Read: Restaurant.*, CommunityRecommendation.*
Write: Vote.direction

### Logic Enforcement

RULE_03: MEDIUM → reject
RULE_04: MEDIUM → reject

## Data Model

### Restaurant

id:                uuid | primary | auto-gen
name:              string | required | indexed
city:              string | required | indexed
address:           string | nullable
phone:             string | nullable
website:           string | nullable
hours:             string | nullable
price_range:       enum('$', '$$', '$$$', '$$$$') | nullable
service_options:   string[] | nullable
status:            enum('UNREVIEWED', 'VERIFIED', 'INCOMPLETE') | required | default(UNREVIEWED)
details_verified:  boolean | default(true)
photo_url:         string | nullable
created_at:        timestamp | auto-gen
updated_at:        timestamp | auto-gen

### CommunityRecommendation

id:               uuid | primary | auto-gen
restaurant_id:    uuid | required | indexed | fk(Restaurant.id, many-to-one)
source:           string | required
post_url:         string | required
summary:          string | required
mention_count:    integer | default(1)
upvotes:          integer | default(0)
downvotes:        integer | default(0)
scraped_at:       timestamp | auto-gen

### Vote

id:                uuid | primary | auto-gen
recommendation_id: uuid | required | indexed | fk(CommunityRecommendation.id, many-to-one)
fingerprint:       string | required | indexed | sensitive
direction:         enum('up', 'down') | required
created_at:        timestamp | auto-gen

## Computed Properties

### net_votes
Aggregate: SUM
Entity: Vote
Filter: entity.recommendation_id == CommunityRecommendation.id
Window: none

### has_community_recommendations
Aggregate: EXISTS
Entity: CommunityRecommendation
Filter: entity.restaurant_id == Restaurant.id
Window: none

### existing_vote
Aggregate: EXISTS
Entity: Vote
Filter: entity.recommendation_id == Vote.recommendation_id AND entity.fingerprint == actor.fingerprint
Window: none

## Logic Rules

### Validation Rules

#### RULE_01: Restaurant Must Have Recommendations to Be Verified
Type: Validation
Entity: Restaurant
Condition: has_community_recommendations == true
Message: "A restaurant must have at least one community recommendation before it can be verified."

#### RULE_02: Restaurant Details Not Found
Type: Validation
Entity: Restaurant
Condition: GooglePlaces.verified(entity.name, entity.city) == false
Message: "Restaurant details could not be confirmed via Google Maps and will be shown as incomplete."

### Business Rules

#### RULE_03: No Duplicate Votes
Type: Business
Entity: Vote
Condition: existing_vote == false
Message: "You have already voted on this recommendation."

#### RULE_04: Search Requires City Context
Type: Business
Entity: Restaurant
Condition: actor.type == 'Visitor' AND GeoDetector.detect_city(actor.context) != null
Message: "We couldn't detect your location. Please confirm your city to see results."
