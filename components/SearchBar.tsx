'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface SearchBarProps {
  initialValue?: string;
  autoDetectCity?: boolean;
}

export default function SearchBar({ initialValue = '', autoDetectCity = false }: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const [detectedCity, setDetectedCity] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!autoDetectCity) return;
    fetch('/api/geo')
      .then((r) => r.json())
      .then((d) => {
        if (d.city) setDetectedCity(d.city);
      })
      .catch(() => undefined);
  }, [autoDetectCity]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const hasCity = / in | near /i.test(q);
    const cityParam = !hasCity && detectedCity
      ? `&city=${encodeURIComponent(detectedCity)}`
      : '';
    router.push(`/search?q=${encodeURIComponent(q)}${cityParam}`);
  }

  function fillCityExample(city: string) {
    if (!query.trim()) {
      setQuery(`best restaurants in ${city}`);
    } else if (!query.toLowerCase().includes(' in ') && !query.toLowerCase().includes(' near ')) {
      setQuery(`${query.trim()} in ${city}`);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Try "most authentic Indian in Ottawa" or "best ramen near Toronto"'
          className="w-full px-5 py-4 pr-32 text-base border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white placeholder-gray-400"
          autoFocus
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Search
        </button>
      </div>

      {detectedCity && (
        <p className="mt-2 text-sm text-gray-500">
          Detected city:{' '}
          <button
            type="button"
            onClick={() => fillCityExample(detectedCity)}
            className="text-blue-600 hover:underline font-medium"
          >
            {detectedCity}
          </button>
        </p>
      )}
    </form>
  );
}
