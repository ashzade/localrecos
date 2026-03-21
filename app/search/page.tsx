import { Suspense } from 'react';
import { searchRestaurants, parseQuery } from '@/lib/search';
import RestaurantCard from '@/components/RestaurantCard';
import SearchBar from '@/components/SearchBar';
import SortBar from '@/components/SortBar';
import SearchPoller from '@/components/SearchPoller';
import { headers } from 'next/headers';

const PRICE_ORDER: Record<string, number> = { '$': 1, '$$': 2, '$$$': 3, '$$$$': 4 };

interface SearchPageProps {
  searchParams: { q?: string; city?: string; sort?: string };
}

async function SearchResults({ q, detectedCity, sort }: { q: string; detectedCity?: string; sort: string }) {
  const parsed = parseQuery(q);
  const city = parsed.city ?? detectedCity ?? null;

  if (!city) {
    return (
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        We couldn&apos;t detect a city in your search. Try including &quot;in [city]&quot; — e.g.{' '}
        <em>&quot;best sushi in Ottawa&quot;</em>.
      </div>
    );
  }

  const rawResults = await searchRestaurants(city, parsed.terms);

  if (rawResults.length < 3) {
    const headersList = headers();
    const host = headersList.get('host') ?? 'localhost:3000';
    const protocol = host.startsWith('localhost') ? 'http' : 'https';
    const origin = `${protocol}://${host}`;
    fetch(`${origin}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ city, query: q }),
    }).catch(() => undefined);
  }

  const results = sort === 'price'
    ? [...rawResults].sort((a, b) => {
        const pa = a.price_range ? (PRICE_ORDER[a.price_range] ?? 99) : 99;
        const pb = b.price_range ? (PRICE_ORDER[b.price_range] ?? 99) : 99;
        return pa - pb;
      })
    : rawResults; // 'votes' is already the default sort from searchRestaurants

  if (results.length === 0) {
    return <SearchPoller />;
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          {results.length} result{results.length !== 1 ? 's' : ''} in{' '}
          <span className="font-medium text-gray-700">{city}</span>
        </p>
        <SortBar current={(sort === 'price' ? 'price' : 'votes')} />
      </div>
      {results.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? '';
  const detectedCity = searchParams.city?.trim();
  const sort = searchParams.sort === 'price' ? 'price' : 'votes';

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
          <SearchResults q={q} detectedCity={detectedCity} sort={sort} />
        </Suspense>
      ) : (
        <p className="mt-6 text-gray-400 text-sm text-center">Enter a search above to get started.</p>
      )}
    </div>
  );
}
