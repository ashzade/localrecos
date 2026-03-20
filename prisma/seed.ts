import { PrismaClient, RestaurantStatus, VoteDirection } from '@prisma/client';

const prisma = new PrismaClient();

const seed = [
  {
    name: "Mambo's Cantina",
    city: 'Ottawa',
    address: '347 Somerset St W, Ottawa, ON',
    phone: '613-555-0101',
    website: 'https://mamboscantina.ca',
    hours: 'Mon-Sun 11am–10pm',
    price_range: '$$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy1',
        summary: 'Hands down the most authentic Mexican in Ottawa. The tacos al pastor are incredible and the portions are massive. Been going weekly for 3 years.',
        upvotes: 42,
        downvotes: 2,
      },
      {
        source: 'r/ottawafoodies',
        post_url: 'https://www.reddit.com/r/ottawafoodies/comments/dummy2',
        summary: "Best margaritas in the city, and the enchiladas are fantastic. Staff are super friendly. Would recommend to anyone looking for Mexican food in Ottawa.",
        upvotes: 28,
        downvotes: 1,
      },
    ],
  },
  {
    name: 'Sansotei Ramen',
    city: 'Ottawa',
    address: '254 Laurier Ave W, Ottawa, ON',
    phone: '613-555-0202',
    website: 'https://sansotei.com',
    hours: 'Mon-Sun 11:30am–9pm',
    price_range: '$$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy3',
        summary: 'Finally a proper ramen spot in Ottawa. The tonkotsu broth is rich and deeply flavoured. Long waits on weekends but worth every minute.',
        upvotes: 67,
        downvotes: 4,
      },
      {
        source: 'r/ottawafoodies',
        post_url: 'https://www.reddit.com/r/ottawafoodies/comments/dummy4',
        summary: 'The black garlic tonkotsu is my go-to. Chashu pork is perfectly tender. This place single-handedly elevated the Ottawa ramen scene.',
        upvotes: 51,
        downvotes: 3,
      },
    ],
  },
  {
    name: 'Le Beau Café',
    city: 'Ottawa',
    address: '22 Byward Market Square, Ottawa, ON',
    phone: '613-555-0303',
    website: null,
    hours: 'Mon-Fri 7am–4pm, Sat-Sun 8am–3pm',
    price_range: '$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy5',
        summary: 'Hidden gem in the Byward Market. Best croissants in the city, full stop. The staff remember your order after two visits. Tiny space but totally worth it.',
        upvotes: 38,
        downvotes: 1,
      },
    ],
  },
  {
    name: 'Shawarma Palace',
    city: 'Ottawa',
    address: '1268 Wellington St W, Ottawa, ON',
    phone: '613-555-0404',
    website: 'https://shawarmpalace.com',
    hours: 'Mon-Sun 10am–2am',
    price_range: '$',
    service_options: ['Dine-in', 'Takeout', 'Delivery'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy6',
        summary: 'Ottawa is the shawarma capital of Canada and this place is proof. Huge portions, amazing garlic sauce, open super late. This is the gold standard.',
        upvotes: 93,
        downvotes: 5,
      },
      {
        source: 'r/ottawafoodies',
        post_url: 'https://www.reddit.com/r/ottawafoodies/comments/dummy7',
        summary: "I've tried probably 20 shawarma spots in Ottawa and Shawarma Palace remains on top. The toum (garlic sauce) alone is worth the trip.",
        upvotes: 74,
        downvotes: 3,
      },
    ],
  },
  {
    name: 'Coconut Lagoon',
    city: 'Ottawa',
    address: '853 St Laurent Blvd, Ottawa, ON',
    phone: '613-555-0505',
    website: null,
    hours: 'Tue-Sun 11:30am–9:30pm',
    price_range: '$$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy8',
        summary: 'Best South Indian food in Ottawa, not even close. The Kerala fish curry is extraordinary. A bit out of the way but completely worth the drive.',
        upvotes: 55,
        downvotes: 2,
      },
    ],
  },
  {
    name: 'Zak\'s Diner',
    city: 'Ottawa',
    address: '14 Byward Market Square, Ottawa, ON',
    phone: '613-555-0606',
    website: 'https://zaksdiner.com',
    hours: 'Mon-Sun 7am–11pm',
    price_range: '$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.UNREVIEWED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/ottawa',
        post_url: 'https://www.reddit.com/r/ottawa/comments/dummy9',
        summary: "Classic Ottawa diner. Been there forever. Nothing fancy but solid comfort food and huge breakfast portions. Great for late nights after the bars.",
        upvotes: 0,
        downvotes: 0,
      },
    ],
  },
  {
    name: 'Ghost Kitchen Experiment',
    city: 'Ottawa',
    address: null,
    phone: null,
    website: null,
    hours: null,
    price_range: null,
    service_options: [],
    status: RestaurantStatus.INCOMPLETE,
    details_verified: false,
    recommendations: [
      {
        source: 'r/ottawafoodies',
        post_url: 'https://www.reddit.com/r/ottawafoodies/comments/dummy10',
        summary: 'Someone mentioned this place does amazing smash burgers delivered only, but I could not find them on Google Maps. Anyone have more info?',
        upvotes: 3,
        downvotes: 1,
      },
    ],
  },
  // Toronto restaurants
  {
    name: 'Pai Northern Thai Kitchen',
    city: 'Toronto',
    address: '18 Duncan St, Toronto, ON',
    phone: '416-555-0701',
    website: 'https://paitoronto.com',
    hours: 'Mon-Sun 11:30am–10pm',
    price_range: '$$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/toronto',
        post_url: 'https://www.reddit.com/r/toronto/comments/dummyt1',
        summary: 'Pad see ew and the massaman curry are incredible. Always a line but they move it fast. Best Thai in Toronto by a wide margin.',
        upvotes: 112,
        downvotes: 7,
      },
    ],
  },
  {
    name: 'Banh Mi Boys',
    city: 'Toronto',
    address: '392 Queen St W, Toronto, ON',
    phone: '416-555-0801',
    website: 'https://banhmiboys.com',
    hours: 'Mon-Sat 11am–8pm',
    price_range: '$',
    service_options: ['Dine-in', 'Takeout'],
    status: RestaurantStatus.VERIFIED,
    details_verified: true,
    recommendations: [
      {
        source: 'r/toronto',
        post_url: 'https://www.reddit.com/r/toronto/comments/dummyt2',
        summary: 'Fusion banh mi that somehow works perfectly. The kimchi pork is my favourite sandwich in the entire city. Fast, cheap, delicious.',
        upvotes: 88,
        downvotes: 4,
      },
    ],
  },
];

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.vote.deleteMany();
  await prisma.communityRecommendation.deleteMany();
  await prisma.restaurant.deleteMany();

  for (const data of seed) {
    const { recommendations, ...restaurantData } = data;

    const restaurant = await prisma.restaurant.create({ data: restaurantData });

    for (const rec of recommendations) {
      const created = await prisma.communityRecommendation.create({
        data: { ...rec, restaurant_id: restaurant.id },
      });

      // Create synthetic votes so net_votes matches the upvote/downvote counts
      const fingerprints = Array.from({ length: rec.upvotes + rec.downvotes }, (_, i) => `seed-fp-${i}`);
      for (let i = 0; i < rec.upvotes; i++) {
        await prisma.vote.create({
          data: {
            recommendation_id: created.id,
            fingerprint: `seed-up-${created.id}-${i}`,
            direction: VoteDirection.up,
          },
        });
      }
      for (let i = 0; i < rec.downvotes; i++) {
        await prisma.vote.create({
          data: {
            recommendation_id: created.id,
            fingerprint: `seed-down-${created.id}-${i}`,
            direction: VoteDirection.down,
          },
        });
      }
    }

    console.log(`  + ${restaurant.name} (${restaurant.city})`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
