'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 10;

export default function SearchPoller() {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (attempts >= MAX_ATTEMPTS) return;

    const timer = setTimeout(() => {
      router.refresh();
      setAttempts((n) => n + 1);
    }, INTERVAL_MS);

    return () => clearTimeout(timer);
  }, [attempts, router]);

  const timedOut = attempts >= MAX_ATTEMPTS;

  return (
    <div className="mt-6 text-center py-12 text-gray-400">
      {timedOut ? (
        <>
          <p className="text-lg font-medium text-gray-600 mb-2">No results found</p>
          <p className="text-sm">We couldn&apos;t find any restaurants matching your search.</p>
        </>
      ) : (
        <>
          <div className="flex justify-center mb-3">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
          <p className="text-sm font-medium text-gray-600">Fetching results…</p>
          <p className="text-xs text-gray-400 mt-1">Searching Reddit and Foursquare for recommendations</p>
        </>
      )}
    </div>
  );
}
