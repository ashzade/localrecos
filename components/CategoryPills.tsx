'use client';

import { useEffect, useState } from 'react';

const CATEGORIES = [
  { label: 'Indian', emoji: '🍛' },
  { label: 'Cafes', emoji: '☕' },
  { label: 'Smoothies', emoji: '🥤' },
  { label: 'Sushi', emoji: '🍣' },
  { label: 'Ramen', emoji: '🍜' },
  { label: 'Pizza', emoji: '🍕' },
  { label: 'Thai', emoji: '🌶️' },
  { label: 'Burgers', emoji: '🍔' },
  { label: 'Brunch', emoji: '🥞' },
  { label: 'Mexican', emoji: '🌮' },
  { label: 'Pho', emoji: '🍲' },
  { label: 'Italian', emoji: '🍝' },
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
      {CATEGORIES.map(({ label, emoji }) => {
        const q = city ? `${label} in ${city}` : label;
        return (
          <a
            key={label}
            href={`/search?q=${encodeURIComponent(q)}${city ? `&city=${encodeURIComponent(city)}` : ''}`}
            className="text-sm px-3 py-1.5 rounded-full border border-gray-200 bg-white text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors shadow-sm"
          >
            {emoji} {label}
          </a>
        );
      })}
    </div>
  );
}
