'use client';

import { useEffect, useState } from 'react';

const CATEGORIES = [
  'Indian', 'Cafes', 'Smoothies', 'Sushi', 'Ramen',
  'Pizza', 'Thai', 'Burgers', 'Brunch', 'Mexican', 'Pho', 'Italian',
];

export default function CategoryPills() {
  const [city, setCity] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('lastKnownCity');
    if (saved) { setCity(saved); return; }
    const interval = setInterval(() => {
      const c = localStorage.getItem('lastKnownCity');
      if (c) { setCity(c); clearInterval(interval); }
    }, 300);
    const timeout = setTimeout(() => clearInterval(interval), 10000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, []);

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {CATEGORIES.map((cat) => {
        const q = city ? `${cat} in ${city}` : cat;
        return (
          <a
            key={cat}
            href={`/search?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ''}`}
            className="text-sm px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
          >
            {cat}
          </a>
        );
      })}
    </div>
  );
}
