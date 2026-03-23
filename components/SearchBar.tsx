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
  const [detectingCity, setDetectingCity] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!autoDetectCity) return;

    setDetectingCity(true);

    const saveAndSet = (city: string | null) => {
      if (city) localStorage.setItem('lastKnownCity', city);
      setDetectedCity(city);
    };

    const fetchIpFallback = () =>
      fetch('/api/geo')
        .then((r) => r.json())
        .then((d) => { saveAndSet(d.city ?? null); })
        .catch(() => undefined)
        .finally(() => setDetectingCity(false));

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          fetch(`/api/geo?lat=${latitude}&lon=${longitude}`)
            .then((r) => r.json())
            .then((d) => { saveAndSet(d.city ?? null); })
            .catch(() => undefined)
            .finally(() => setDetectingCity(false));
        },
        () => fetchIpFallback(),
        { timeout: 5000 }
      );
    } else {
      fetchIpFallback();
    }
  }, [autoDetectCity]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const hasCity = / in | near /i.test(q);
    const city = detectedCity ?? localStorage.getItem('lastKnownCity');
    const cityParam = !hasCity && city
      ? `&city=${encodeURIComponent(city)}`
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

      {autoDetectCity && (
        <p className="mt-2 text-sm text-gray-500">
          {detectingCity ? (
            <span className="text-gray-400">Detecting your city...</span>
          ) : detectedCity ? (
            <>
              Detected city:{' '}
              <button
                type="button"
                onClick={() => fillCityExample(detectedCity)}
                className="text-blue-600 hover:underline font-medium"
              >
                {detectedCity}
              </button>
            </>
          ) : (
            <span className="text-gray-400">Could not detect city — include &quot;in [city]&quot; in your search</span>
          )}
        </p>
      )}
    </form>
  );
}
