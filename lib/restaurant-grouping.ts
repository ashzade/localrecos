/**
 * Pure restaurant-grouping logic shared between the server (lib/search.ts)
 * and the client (components/LoadMoreButton.tsx).
 * No server-only imports — safe to use in 'use client' components.
 */

export interface RestaurantLocation {
  id: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  hours: string | null;
  upvotes: number;
  downvotes: number;
}

export interface GroupableRecommendation {
  id: string;
  source: string;
  post_url: string;
  summary: string;
  mention_count: number;
  source_upvotes: number;
  upvotes: number;
  downvotes: number;
  scraped_at: string | Date;
}

export interface GroupableRestaurant {
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
  recommendations: GroupableRecommendation[];
}

export interface RestaurantGroup {
  id: string;
  name: string;
  city: string;
  price_range: string | null;
  photo_url: string | null;
  status: string;
  upvotes: number;
  downvotes: number;
  total_net_votes: number;
  recommendations: GroupableRecommendation[];
  locations: RestaurantLocation[];
}

export function normalizeWebsite(url: string | null): string | null {
  if (!url) return null;
  try {
    const { hostname } = new URL(url);
    return hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return url.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
  }
}

function shouldMerge(a: GroupableRestaurant[], b: GroupableRestaurant[]): boolean {
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

function buildGroup(group: GroupableRestaurant[]): RestaurantGroup {
  const sorted = [...group].sort((a, b) => b.total_net_votes - a.total_net_votes);
  const primary = sorted[0];
  const seenUrls = new Set<string>();
  const mergedRecs = sorted
    .flatMap((r) => r.recommendations)
    .filter((rec) => {
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
}

/**
 * Group restaurants by name (and merge locations with the same website or
 * prefix-matched name). Optionally exclude restaurants whose normalised name
 * is already present in `excludeNames`.
 */
export function groupRestaurantsByName(
  restaurants: GroupableRestaurant[],
  excludeNames?: Set<string>,
): RestaurantGroup[] {
  const map = new Map<string, GroupableRestaurant[]>();
  for (const r of restaurants) {
    const key = r.name.toLowerCase().trim();
    if (excludeNames?.has(key)) continue;
    const group = map.get(key) ?? [];
    group.push(r);
    map.set(key, group);
  }

  let groups = Array.from(map.values());
  let merged = true;
  while (merged) {
    merged = false;
    const next: GroupableRestaurant[][] = [];
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

  return groups.map(buildGroup).sort((a, b) => b.total_net_votes - a.total_net_votes);
}
