'use client';

import { useState } from 'react';
import RestaurantCard from './RestaurantCard';
import { PRICE_ORDER, type RestaurantGroup } from '@/lib/restaurant-grouping';
const BATCH = 30; // fetch enough raw rows to produce ~10 grouped results

interface LoadMoreButtonProps {
  city: string;
  terms: string;
  sort: string;
  initialOffset: number;
  shownNames: string[];
}

export default function LoadMoreButton({ city, terms, sort, initialOffset, shownNames }: LoadMoreButtonProps) {
  const [groups, setGroups] = useState<RestaurantGroup[]>([]);
  const [offset, setOffset] = useState(initialOffset);
  const [seenNames, setSeenNames] = useState<Set<string>>(new Set(shownNames));
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  async function loadMore() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        city, terms,
        offset: String(offset),
        limit: String(BATCH),
        seenNames: [...seenNames].join(','),
      });
      const res = await fetch(`/api/search-more?${params}`);
      const data = await res.json();

      const newGroups: RestaurantGroup[] = data.results ?? [];
      const sorted = sort === 'price'
        ? [...newGroups].sort((a, b) => (PRICE_ORDER[a.price_range ?? ''] ?? 99) - (PRICE_ORDER[b.price_range ?? ''] ?? 99))
        : newGroups;

      const newSeen = new Set(seenNames);
      for (const g of newGroups) newSeen.add(g.name.toLowerCase().trim());

      setGroups((prev) => [...prev, ...sorted]);
      setSeenNames(newSeen);
      setOffset(data.nextOffset ?? offset + BATCH);
      setHasMore(data.hasMore && newGroups.length > 0);
    } catch {
      // Network or parse failure — leave existing results and hasMore intact
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {groups.map((g) => (
        <RestaurantCard
          key={g.id}
          restaurant={{ ...g, address: g.locations[0]?.address ?? null, phone: g.locations[0]?.phone ?? null, website: g.locations[0]?.website ?? null, hours: g.locations[0]?.hours ?? null }}
        />
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
