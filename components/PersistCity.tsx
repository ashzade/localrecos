'use client';

import { useEffect } from 'react';

export default function PersistCity({ city }: { city: string }) {
  useEffect(() => {
    localStorage.setItem('lastKnownCity', city);
  }, [city]);

  return null;
}
