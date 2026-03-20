'use client';

import { useState } from 'react';
import Image from 'next/image';
import RecommendationCard from './RecommendationCard';
import RestaurantFeedbackButton from './RestaurantFeedbackButton';

interface Recommendation {
  id: string;
  source: string;
  post_url: string;
  summary: string;
  mention_count: number;
  scraped_at: string | Date;
}

interface Restaurant {
  id: string;
  name: string;
  city: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  price_range: string | null;
  photo_url: string | null;
  status: string;
  details_verified: boolean;
  upvotes: number;
  downvotes: number;
  total_net_votes: number;
  recommendations: Recommendation[];
}

interface RestaurantCardProps {
  restaurant: Restaurant;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: 'Verified', className: 'bg-green-100 text-green-700' },
  UNREVIEWED: { label: 'New', className: 'bg-blue-100 text-blue-700' },
  INCOMPLETE: { label: 'Unconfirmed', className: 'bg-gray-100 text-gray-500' },
};

function isOpenNow(hours: string): boolean | null {
  try {
    const now = new Date();
    const jsDay = now.getDay();
    const placesDay = jsDay === 0 ? 6 : jsDay - 1;
    const segments = hours.split(' | ');
    const todaySegment = segments[placesDay];
    if (!todaySegment) return null;
    const timesPart = todaySegment.replace(/^[^:]+:\s*/, '').trim();
    if (timesPart.toLowerCase() === 'closed') return false;
    if (timesPart.toLowerCase().includes('24 hours')) return true;
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
    if (closeMin < openMin) return nowMin >= openMin || nowMin < closeMin;
    return nowMin >= openMin && nowMin < closeMin;
  } catch {
    return null;
  }
}

function getSentimentSummary(recommendations: Recommendation[]): string | null {
  if (!recommendations.length) return null;
  const top = [...recommendations].sort((a, b) => b.mention_count - a.mention_count)[0];
  const sentence = top.summary.split(/(?<=[.!?])\s/)[0].trim();
  return sentence.length > 120 ? sentence.slice(0, 117) + '...' : sentence;
}

const VISIBLE_COUNT = 3;

export default function RestaurantCard({ restaurant: r }: RestaurantCardProps) {
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const statusInfo = STATUS_LABELS[r.status] ?? STATUS_LABELS.UNREVIEWED;
  const sentiment = getSentimentSummary(r.recommendations);
  const visible = showAll ? r.recommendations : r.recommendations.slice(0, VISIBLE_COUNT);
  const hidden = r.recommendations.length - VISIBLE_COUNT;
  const openNow = r.hours ? isOpenNow(r.hours) : null;
  const mapsUrl = r.address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.address)}`
    : null;

  function shareLink() {
    const url = `${window.location.origin}/restaurant/${r.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden">
      <div className="flex gap-0">
        {/* Photo */}
        <div className="relative w-32 flex-shrink-0 sm:w-44 bg-gray-100">
          {r.photo_url ? (
            <Image
              src={r.photo_url}
              alt={r.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 128px, 176px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
              </svg>
            </div>
          )}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 p-5">
          {/* Header row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`/restaurant/${r.id}`}
                  className="text-lg font-semibold text-gray-900 hover:underline"
                >
                  {r.name}
                </a>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.className}`}>
                  {statusInfo.label}
                </span>
                {r.price_range && (
                  <span className="text-sm text-gray-500">{r.price_range}</span>
                )}
                {openNow !== null && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {openNow ? 'Open now' : 'Closed now'}
                  </span>
                )}
              </div>

              {r.address && (
                mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block text-sm text-blue-600 hover:underline"
                  >
                    {r.address}
                  </a>
                ) : (
                  <p className="mt-0.5 text-sm text-gray-500">{r.address}</p>
                )
              )}
            </div>

            <button
              onClick={shareLink}
              className="flex-shrink-0 text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
            >
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>

          {/* Sentiment summary */}
          {sentiment && (
            <p className="mt-2 text-sm text-gray-600 italic">&ldquo;{sentiment}&rdquo;</p>
          )}

          {/* Website */}
          {r.website && (
            <a
              href={r.website}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
            >
              <span>🌐</span>
              {r.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}

          {!r.details_verified && (
            <p className="mt-1 text-xs text-amber-600">Details unconfirmed — community mention only</p>
          )}

          {/* LocalRecos community feedback on this restaurant */}
          <div className="mt-3 flex items-center gap-3">
            <RestaurantFeedbackButton
              restaurantId={r.id}
              initialUpvotes={r.upvotes}
              initialDownvotes={r.downvotes}
            />
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {r.recommendations.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 px-5 py-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Community picks
          </p>
          {visible.map((rec) => (
            <RecommendationCard key={rec.id} recommendation={rec} />
          ))}
          {!showAll && hidden > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="text-sm text-blue-600 hover:underline"
            >
              + {hidden} more recommendation{hidden !== 1 ? 's' : ''}
            </button>
          )}
          {showAll && r.recommendations.length > VISIBLE_COUNT && (
            <button
              onClick={() => setShowAll(false)}
              className="text-sm text-gray-400 hover:underline"
            >
              Show less
            </button>
          )}
        </div>
      )}
    </div>
  );
}
