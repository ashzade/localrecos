'use client';

import { useState } from 'react';
import RestaurantCard from './RestaurantCard';

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
  upvotes: number;
  downvotes: number;
  total_net_votes: number;
  recommendations: Array<{
    id: string;
    source: string;
    post_url: string;
    summary: string;
    mention_count: number;
    source_upvotes: number;
    upvotes: number;
    downvotes: number;
    scraped_at: string;
  }>;
}

interface LoadMoreButtonProps {
  city: string;
  terms: string;
  sort: string;
  initialOffset: number;
}

export default function LoadMoreButton({ city, terms, sort, initialOffset }: LoadMoreButtonProps) {
  const [results, setResults] = useState<Restaurant[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        city,
        terms,
        offset: String(offset),
        limit: '10',
      });
      const res = await fetch(`/api/search-more?${params}`);
      const data = await res.json();
      const sorted: Restaurant[] = sort === 'price'
        ? [...data.results].sort((a: Restaurant, b: Restaurant) => {
            const order: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
            return (order[a.price_range ?? ''] ?? 99) - (order[b.price_range ?? ''] ?? 99);
          })
        : data.results;
      setResults((prev) => [...prev, ...sorted]);
      setOffset(offset + sorted.length);
      setHasMore(data.hasMore);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {results.map((r) => (
        <RestaurantCard key={r.id} restaurant={r} />
      ))}
      {hasMore && (
        <div className="pt-2 text-center">
          <button
            onClick={loadMore}
            disabled={loading}
            className="text-sm text-blue-600 hover:underline font-medium disabled:opacity-50"
          >
            {loading ? 'Loading…' : 'More'}
          </button>
        </div>
      )}
    </>
  );
}
