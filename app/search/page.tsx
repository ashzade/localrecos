import { Suspense } from 'react';
import { searchRestaurants, parseQuery } from '@/lib/search';
import RestaurantCard from '@/components/RestaurantCard';
import SearchBar from '@/components/SearchBar';
import SortBar from '@/components/SortBar';
import SearchPoller from '@/components/SearchPoller';
import PersistCity from '@/components/PersistCity';

const PRICE_ORDER: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

const PAGE_SIZE = 10;

interface SearchPageProps {
  searchParams: { q?: string; city?: string; sort?: string; limit?: string };
}

async function SearchResults({ q, detectedCity, sort, limit }: { q: string; detectedCity?: string; sort: string; limit: number }) {
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

  // Fetch one extra to detect if more results exist
  const rawResults = await searchRestaurants(city, parsed.terms, limit + 1);
  const hasMore = rawResults.length > limit;
  const page = rawResults.slice(0, limit);

  const results = sort === 'price'
    ? [...page].sort((a, b) => {
        const pa = a.price_range ? (PRICE_ORDER[a.price_range] ?? 99) : 99;
        const pb = b.price_range ? (PRICE_ORDER[b.price_range] ?? 99) : 99;
        return pa - pb;
      })
    : page;

  if (results.length === 0) {
    return <SearchPoller city={city} query={q} />;
  }

  const cityParam = detectedCity ? `&city=${encodeURIComponent(detectedCity)}` : '';
  const moreUrl = `/search?q=${encodeURIComponent(q)}${cityParam}&sort=${sort}&limit=${limit + PAGE_SIZE}`;

  return (
    <div className="mt-6 space-y-4">
      <PersistCity city={city} />
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          {results.length}{hasMore ? '+' : ''} result{results.length !== 1 ? 's' : ''} in{' '}
          <span className="font-medium text-gray-700">{city}</span>
          {parsed.terms && (
            <span className="text-gray-400"> · searching for &ldquo;{parsed.terms}&rdquo;</span>
          )}
        </p>
        <SortBar current={(sort === 'price' ? 'price' : 'votes')} />
      </div>
      {results.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
      {hasMore && (
        <div className="pt-2 text-center">
          <a
            href={moreUrl}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            More
          </a>
        </div>
      )}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? '';
  const detectedCity = searchParams.city?.trim();
  const sort = searchParams.sort === 'price' ? 'price' : 'votes';
  const limit = Math.min(Math.max(parseInt(searchParams.limit ?? '0') || PAGE_SIZE, PAGE_SIZE), 100);

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
          <SearchResults q={q} detectedCity={detectedCity} sort={sort} limit={limit} />
        </Suspense>
      ) : (
        <p className="mt-6 text-gray-400 text-sm text-center">Enter a search above to get started.</p>
      )}
    </div>
  );
}
