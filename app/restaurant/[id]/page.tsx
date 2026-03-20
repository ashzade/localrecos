import { notFound } from 'next/navigation';
import Image from 'next/image';
import prisma from '@/lib/db';
import RecommendationCard from '@/components/RecommendationCard';
import RestaurantFeedbackButton from '@/components/RestaurantFeedbackButton';

interface RestaurantPageProps {
  params: { id: string };
}

const STATUS_INFO: Record<string, { label: string; className: string; description: string }> = {
  VERIFIED: {
    label: 'Verified',
    className: 'bg-green-100 text-green-700',
    description: 'Community has voted on this restaurant',
  },
  UNREVIEWED: {
    label: 'New',
    className: 'bg-blue-100 text-blue-700',
    description: 'Recently added, awaiting community votes',
  },
  INCOMPLETE: {
    label: 'Unconfirmed',
    className: 'bg-gray-100 text-gray-500',
    description: 'Details could not be confirmed via Google Maps',
  },
};

/**
 * Parses the stored hours string (e.g. "Monday: 9:00 AM – 10:00 PM | Tuesday: Closed | ...")
 * and returns true if the restaurant is currently open.
 */
function isOpenNow(hours: string): boolean | null {
  try {
    const now = new Date();
    // getDay(): 0=Sun, 1=Mon, ..., 6=Sat
    // weekday_text order: 0=Mon, ..., 5=Sat, 6=Sun
    const jsDay = now.getDay();
    const placesDay = jsDay === 0 ? 6 : jsDay - 1;

    const segments = hours.split(' | ');
    const todaySegment = segments[placesDay];
    if (!todaySegment) return null;

    const timesPart = todaySegment.replace(/^[^:]+:\s*/, '').trim();
    if (timesPart.toLowerCase() === 'closed') return false;

    // Handle "Open 24 hours"
    if (timesPart.toLowerCase().includes('24 hours')) return true;

    // Parse "9:00 AM – 10:00 PM" (note: en-dash)
    const rangeMatch = timesPart.match(/(\d{1,2}:\d{2}\s*[AP]M)\s*[–\-]\s*(\d{1,2}:\d{2}\s*[AP]M)/i);
    if (!rangeMatch) return null;

    function parseTime(t: string): number {
      const m = t.trim().match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);
      if (!m) return 0;
      let h = parseInt(m[1]);
      const min = parseInt(m[2]);
      const ampm = m[3].toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      return h * 60 + min;
    }

    const openMin = parseTime(rangeMatch[1]);
    const closeMin = parseTime(rangeMatch[2]);
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Handle overnight hours (e.g. 10 PM – 2 AM)
    if (closeMin < openMin) {
      return nowMin >= openMin || nowMin < closeMin;
    }
    return nowMin >= openMin && nowMin < closeMin;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: RestaurantPageProps) {
  const restaurant = await prisma.restaurant.findUnique({ where: { id: params.id } });
  if (!restaurant) return { title: 'Not Found' };
  return {
    title: `${restaurant.name} in ${restaurant.city} — LocalRecos`,
    description: `Community recommendations for ${restaurant.name} in ${restaurant.city}`,
  };
}

export default async function RestaurantPage({ params }: RestaurantPageProps) {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: params.id },
    include: {
      recommendations: {
        orderBy: [{ mention_count: 'desc' }, { scraped_at: 'desc' }],
      },
    },
  });

  if (!restaurant) notFound();

  const statusInfo = STATUS_INFO[restaurant.status] ?? STATUS_INFO.UNREVIEWED;

  const recs = restaurant.recommendations.map((rec) => ({
    ...rec,
    scraped_at: rec.scraped_at.toISOString(),
  }));

  const totalNetVotes = (restaurant.upvotes ?? 0) - (restaurant.downvotes ?? 0);
  const openNow = restaurant.hours ? isOpenNow(restaurant.hours) : null;
  const mapsUrl = restaurant.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant.address)}`
    : null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <a href="javascript:history.back()" className="text-sm text-blue-600 hover:underline mb-4 inline-block">
        ← Back
      </a>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
        {/* Hero image */}
        <div className="relative w-full h-52 bg-gray-100">
          {restaurant.photo_url ? (
            <Image
              src={restaurant.photo_url}
              alt={restaurant.name}
              fill
              className="object-cover"
              sizes="672px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
          )}
        </div>

        <div className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{restaurant.name}</h1>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
                {restaurant.price_range && (
                  <span className="text-gray-500">{restaurant.price_range}</span>
                )}
                {openNow !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {openNow ? 'Open now' : 'Closed now'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500">{statusInfo.description}</p>
            </div>
            <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
              <RestaurantFeedbackButton
                restaurantId={restaurant.id}
                initialUpvotes={restaurant.upvotes}
                initialDownvotes={restaurant.downvotes}
              />
              <span className="text-xs text-gray-400">
                {totalNetVotes === 0
                  ? 'No votes yet'
                  : `${totalNetVotes > 0 ? '+' : ''}${totalNetVotes} community score`}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {restaurant.address && (
              <div>
                <span className="text-gray-400">Address</span>
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-blue-600 hover:underline"
                  >
                    {restaurant.address}
                  </a>
                ) : (
                  <p className="text-gray-700">{restaurant.address}</p>
                )}
              </div>
            )}
            {restaurant.phone && (
              <div>
                <span className="text-gray-400">Phone</span>
                <p className="text-gray-700">
                  <a href={`tel:${restaurant.phone}`} className="hover:underline">
                    {restaurant.phone}
                  </a>
                </p>
              </div>
            )}
            {restaurant.website && (
              <div>
                <span className="text-gray-400">Website</span>
                <a
                  href={restaurant.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-blue-600 hover:underline truncate"
                >
                  {restaurant.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                </a>
              </div>
            )}
            {restaurant.hours && (
              <div className={restaurant.website ? '' : ''}>
                <span className="text-gray-400">Hours</span>
                <p className="text-gray-700 text-xs leading-relaxed">
                  {restaurant.hours.split(' | ').map((line, i) => (
                    <span key={i} className="block">{line}</span>
                  ))}
                </p>
              </div>
            )}
            {restaurant.service_options.length > 0 && (
              <div className="sm:col-span-2">
                <span className="text-gray-400">Options</span>
                <p className="text-gray-700">{restaurant.service_options.join(' · ')}</p>
              </div>
            )}
          </div>

          {!restaurant.details_verified && (
            <p className="mt-3 text-xs text-amber-600 bg-amber-50 rounded px-3 py-2">
              Details for this restaurant could not be confirmed via Google Maps. Information shown is sourced from community mentions only.
            </p>
          )}
        </div>
      </div>

      <h2 className="text-base font-semibold text-gray-700 mb-3">
        Community Recommendations ({recs.length})
      </h2>

      {recs.length === 0 ? (
        <p className="text-sm text-gray-400">No community recommendations yet.</p>
      ) : (
        <div className="space-y-3">
          {recs.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
        </div>
      )}
    </div>
  );
}
