'use client';

import { useEffect } from 'react';

const DEFAULT_CITY = process.env.NEXT_PUBLIC_DEFAULT_CITY ?? '';

export default function PersistCity({ city }: { city: string }) {
  useEffect(() => {
    const resolved = city || DEFAULT_CITY;
    if (!resolved) return;
    localStorage.setItem('lastKnownCity', resolved);
  }, [city]);

  return null;
}
