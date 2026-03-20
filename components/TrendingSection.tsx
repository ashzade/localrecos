'use client';

import { useEffect, useState } from 'react';

interface TrendingRestaurant {
  id: string;
  name: string;
  city: string;
  address: string | null;
  price_range: string | null;
  hours: string | null;
  status: string;
  recommendation_count: number;
  total_net_votes: number;
}

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

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: 'Verified', className: 'bg-green-100 text-green-700' },
  UNREVIEWED: { label: 'New', className: 'bg-blue-100 text-blue-700' },
  INCOMPLETE: { label: 'Unconfirmed', className: 'bg-gray-100 text-gray-500' },
};

export default function TrendingSection() {
  const [city, setCity] = useState<string | null>(null);
  const [results, setResults] = useState<TrendingRestaurant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/trending')
      .then((r) => r.json())
      .then((d) => {
        setCity(d.city);
        setResults(d.results ?? []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-12">
        <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        <div className="mt-3 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const displayCity = city ?? 'Ottawa';

  if (results.length === 0) {
    return (
      <div className="mt-12">
        <h2 className="text-base font-semibold text-gray-700">Trending in {displayCity}</h2>
        <p className="mt-2 text-sm text-gray-400">
          No data yet. Be the first to search for restaurants in {city}.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <h2 className="text-base font-semibold text-gray-700 mb-3">
        Trending in {displayCity}
      </h2>
      <div className="space-y-2">
        {results.map((r, i) => {
          const openNow = r.hours ? isOpenNow(r.hours) : null;
          return (
          <a
            key={r.id}
            href={`/restaurant/${r.id}`}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors group"
          >
            <span className="text-sm font-bold text-gray-300 w-5 text-right flex-shrink-0">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
                <span className="text-sm font-medium text-gray-800 group-hover:text-blue-600 truncate">
                  {r.name}
                </span>
                {(() => {
                  const badge = STATUS_BADGE[r.status] ?? STATUS_BADGE.UNREVIEWED;
                  return (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  );
                })()}
                {openNow !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                    {openNow ? 'Open' : 'Closed'}
                  </span>
                )}
              </div>
              {r.address && (
                <span className="text-xs text-gray-400 truncate block">{r.address}</span>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 text-xs text-gray-400">
              {r.price_range && <span>{r.price_range}</span>}
              <span>{r.recommendation_count} rec{r.recommendation_count !== 1 ? 's' : ''}</span>
              {Number.isFinite(r.total_net_votes) && r.total_net_votes !== 0 && (
                <span className={r.total_net_votes > 0 ? 'text-green-600 font-medium' : ''}>
                  {r.total_net_votes > 0 ? '+' : ''}{r.total_net_votes}
                </span>
              )}
            </div>
          </a>
          );
        })}
      </div>
    </div>
  );
}
