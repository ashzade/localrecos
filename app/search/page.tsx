import { Suspense } from 'react';
import { searchRestaurants, parseQuery } from '@/lib/search';
import RestaurantCard from '@/components/RestaurantCard';
import SearchBar from '@/components/SearchBar';

interface SearchPageProps {
  searchParams: { q?: string };
}

async function SearchResults({ q }: { q: string }) {
  const parsed = parseQuery(q);

  if (!parsed.city) {
    return (
      <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        We couldn&apos;t detect a city in your search. Try including &quot;in [city]&quot; — e.g.{' '}
        <em>&quot;best sushi in Ottawa&quot;</em>.
      </div>
    );
  }

  const results = await searchRestaurants(parsed.city, parsed.terms);

  if (results.length === 0) {
    return (
      <div className="mt-6 text-center py-12 text-gray-400">
        <p className="text-lg font-medium text-gray-600 mb-2">No results yet</p>
        <p className="text-sm">
          We&apos;re fetching community recommendations from Reddit. Try again in a moment.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-gray-500">
        {results.length} result{results.length !== 1 ? 's' : ''} in{' '}
        <span className="font-medium text-gray-700">{parsed.city}</span>
      </p>
      {results.map((restaurant) => (
        <RestaurantCard key={restaurant.id} restaurant={restaurant} />
      ))}
    </div>
  );
}

export default function SearchPage({ searchParams }: SearchPageProps) {
  const q = searchParams.q?.trim() ?? '';

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
          <SearchResults q={q} />
        </Suspense>
      ) : (
        <p className="mt-6 text-gray-400 text-sm text-center">Enter a search above to get started.</p>
      )}
    </div>
  );
}
