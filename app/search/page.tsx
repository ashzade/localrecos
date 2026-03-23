import { Suspense } from 'react';
import { searchRestaurants, parseQuery, groupRestaurantsByName } from '@/lib/search';
import { isOpenNow } from '@/lib/hours';
import RestaurantCard from '@/components/RestaurantCard';
import SearchBar from '@/components/SearchBar';
import SortBar from '@/components/SortBar';
import SearchPoller from '@/components/SearchPoller';
import PersistCity from '@/components/PersistCity';
import LoadMoreButton from '@/components/LoadMoreButton';

const PRICE_ORDER: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

const PAGE_SIZE = 10;

interface SearchPageProps {
  searchParams: { q?: string; city?: string; sort?: string; open?: string };
}

async function SearchResults({ q, detectedCity, sort, openNow, limit }: { q: string; detectedCity?: string; sort: string; openNow: boolean; limit: number }) {
  const parsed = await parseQuery(q);
  const city = parsed.city ?? detectedCity ?? null;

  if (!city) {
    return (
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        We couldn&apos;t detect a city in your search. Try including &quot;in [city]&quot; — e.g.{' '}
        <em>&quot;best sushi in Ottawa&quot;</em>.
      </div>
    );
  }

  // Fetch more than limit to account for grouping collapsing multi-location restaurants
  const rawResults = await searchRestaurants(city, parsed.terms, limit * 3);
  const grouped = groupRestaurantsByName(rawResults);
  const hasMore = grouped.length > limit;
  const page = grouped.slice(0, limit);

  let results = sort === 'price'
    ? [...page].sort((a, b) => {
        const pa = a.price_range ? (PRICE_ORDER[a.price_range] ?? 99) : 99;
        const pb = b.price_range ? (PRICE_ORDER[b.price_range] ?? 99) : 99;
        return pa - pb;
      })
    : page;

  if (openNow) {
    results = results.filter((g) => {
      const hours = g.locations.find((l) => l.hours)?.hours;
      return hours ? isOpenNow(hours) === true : false;
    });
  }

  const sortBar = (
    <div className="flex items-center justify-between flex-wrap gap-2">
      <p className="text-sm text-gray-500">
        {results.length}{hasMore ? '+' : ''} result{results.length !== 1 ? 's' : ''} in{' '}
        <span className="font-medium text-gray-700">{city}</span>
        {parsed.terms && (
          <span className="text-gray-400"> · searching for &ldquo;{parsed.terms}&rdquo;</span>
        )}
      </p>
      <SortBar current={(sort === 'price' ? 'price' : 'votes')} openNow={openNow} />
    </div>
  );

  if (results.length === 0) {
    return (
      <div className="mt-6 space-y-4">
        <PersistCity city={city} />
        {sortBar}
        <SearchPoller city={city} query={q} />
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <PersistCity city={city} />
      {sortBar}
      {results.map((group) => (
        <RestaurantCard
          key={group.id}
          restaurant={{
            ...group,
            address: group.locations[0]?.address ?? null,
            phone: group.locations[0]?.phone ?? null,
            website: group.locations[0]?.website ?? null,
            hours: group.locations[0]?.hours ?? null,
          }}
        />
      ))}
      {hasMore && (
        <LoadMoreButton
          city={city}
          terms={parsed.terms}
          sort={sort}
          initialOffset={limit * 3}
          shownNames={(() => {
            const shownIds = new Set(results.flatMap((g) => g.locations.map((l) => l.id)));
            return rawResults
              .filter((r) => shownIds.has(r.id))
              .map((r) => r.name.toLowerCase().trim());
          })()}
        />
      )}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? '';
  const detectedCity = searchParams.city?.trim();
  const sort = searchParams.sort === 'price' ? 'price' : 'votes';
  const openNow = searchParams.open === '1';
  const limit = PAGE_SIZE;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <SearchBar initialValue={q} />

      {q ? (
        <Suspense
          fallback={
            <div className="mt-6 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          }
        >
          <SearchResults q={q} detectedCity={detectedCity} sort={sort} openNow={openNow} limit={limit} />
        </Suspense>
      ) : (
        <p className="mt-6 text-gray-400 text-sm text-center">Enter a search above to get started.</p>
      )}
    </div>
  );
}
