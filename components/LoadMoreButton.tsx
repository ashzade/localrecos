'use client';

import { useState } from 'react';
import RestaurantCard from './RestaurantCard';

interface Location {
  id: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  upvotes: number;
  downvotes: number;
}

interface RestaurantGroup {
  id: string;
  name: string;
  city: string;
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
  locations: Location[];
}

interface RawRestaurant {
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
  recommendations: RestaurantGroup['recommendations'];
}

function normalizeWebsite(url: string | null): string | null {
  if (!url) return null;
  return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}

function shouldMerge(a: RawRestaurant[], b: RawRestaurant[]): boolean {
  const websitesA = new Set(a.map((r) => normalizeWebsite(r.website)).filter(Boolean));
  for (const r of b) {
    const w = normalizeWebsite(r.website);
    if (w && websitesA.has(w)) return true;
  }
  const nameA = a[0].name.toLowerCase().trim();
  const nameB = b[0].name.toLowerCase().trim();
  const shorter = nameA.length <= nameB.length ? nameA : nameB;
  const longer = nameA.length <= nameB.length ? nameB : nameA;
  if (shorter.length >= 5 && longer.startsWith(shorter) && (longer.length === shorter.length || /\W/.test(longer[shorter.length]))) {
    return true;
  }
  return false;
}

function groupByName(restaurants: RawRestaurant[], excludeNames: Set<string>): RestaurantGroup[] {
  const map = new Map<string, RawRestaurant[]>();
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    if (excludeNames.has(key)) continue;
    const group = map.get(key) ?? [];
    group.push(r);
    map.set(key, group);
  }

  // Second pass: merge groups with shared website or prefix-name match
  let groups = Array.from(map.values());
  let merged = true;
  while (merged) {
    merged = false;
    const next: RawRestaurant[][] = [];
    const used = new Set<number>();
    for (let i = 0; i < groups.length; i++) {
      if (used.has(i)) continue;
      let combined = groups[i];
      for (let j = i + 1; j < groups.length; j++) {
        if (used.has(j)) continue;
        if (shouldMerge(combined, groups[j])) {
          combined = [...combined, ...groups[j]];
          used.add(j);
          merged = true;
        }
      }
      next.push(combined);
      used.add(i);
    }
    groups = next;
  }

  return groups
    .map((group) => {
      const sorted = [...group].sort((a, b) => b.total_net_votes - a.total_net_votes);
      const primary = sorted[0];
      const seenUrls = new Set<string>();
      const mergedRecs = sorted.flatMap((r) => r.recommendations).filter((rec) => {
        if (seenUrls.has(rec.post_url)) return false;
        seenUrls.add(rec.post_url);
        return true;
      });
      return {
        id: primary.id,
        name: primary.name,
        city: primary.city,
        price_range: primary.price_range,
        photo_url: primary.photo_url,
        status: primary.status,
        upvotes: group.reduce((s, r) => s + r.upvotes, 0),
        downvotes: group.reduce((s, r) => s + r.downvotes, 0),
        total_net_votes: group.reduce((s, r) => s + r.total_net_votes, 0),
        recommendations: mergedRecs,
        locations: sorted.map((r) => ({
          id: r.id,
          address: r.address,
          phone: r.phone,
          website: r.website,
          hours: r.hours,
          upvotes: r.upvotes,
          downvotes: r.downvotes,
        })),
      };
    })
    .sort((a, b) => b.total_net_votes - a.total_net_votes);
}

const PRICE_ORDER: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };
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
      const params = new URLSearchParams({ city, terms, offset: String(offset), limit: String(BATCH) });
      const res = await fetch(`/api/search-more?${params}`);
      const data = await res.json();

      const newGroups = groupByName(data.results as RawRestaurant[], seenNames);
      const sorted = sort === 'price'
        ? [...newGroups].sort((a, b) => (PRICE_ORDER[a.price_range ?? ''] ?? 99) - (PRICE_ORDER[b.price_range ?? ''] ?? 99))
        : newGroups;

      const shownIds = new Set(newGroups.flatMap((g) => g.locations.map((l) => l.id)));
      const newSeen = new Set(seenNames);
      for (const r of (data.results as RawRestaurant[])) {
        if (shownIds.has(r.id)) newSeen.add(r.name.toLowerCase().trim());
      }

      setGroups((prev) => [...prev, ...sorted]);
      setSeenNames(newSeen);
      setOffset(offset + data.results.length);
      setHasMore(data.hasMore && data.results.length > 0);
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
