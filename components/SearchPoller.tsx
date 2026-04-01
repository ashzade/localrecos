'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const POLL_INTERVAL_MS = 2500;

interface SearchPollerProps {
  city: string;
  query: string;
  hasResults: boolean;
}

export default function SearchPoller({ city, query, hasResults }: SearchPollerProps) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const scrapeFinished = useRef(false);

  // Fire scrape and poll until it completes
  useEffect(() => {
    let stopped = false;

    async function run() {
      // Poll in the background while scrape is running
      const pollInterval = setInterval(() => {
        if (!stopped) router.refresh();
      }, POLL_INTERVAL_MS);

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ city, query }),
        });
        const data = await res.json().catch(() => ({}));
        scrapeFinished.current = true;
        clearInterval(pollInterval);
        if (!stopped) {
          router.refresh();
          if (data.created === 0 && !hasResults) setTimedOut(true);
          else setDone(true);
        }
      } catch {
        clearInterval(pollInterval);
        if (!stopped) {
          if (!hasResults) setTimedOut(true);
          else setDone(true);
        }
      }
    }

    run();
    return () => { stopped = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, query]);

  if (done) return null;

  if (timedOut) {
    return (
      <div className="mt-6 text-center py-12 text-gray-400">
        <p className="text-lg font-medium text-gray-600 mb-2">No results found</p>
        <p className="text-sm">We couldn&apos;t find any restaurants matching your search.</p>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="mt-6 text-center py-12">
        <div className="flex justify-center mb-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-sm font-medium text-gray-600">Searching Reddit…</p>
        <p className="text-xs text-gray-400 mt-1">Finding recommendations and validating with Google Places</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
      <div className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
      Searching for more results…
    </div>
  );
}
