'use client';

import { useState } from 'react';

interface RestaurantFeedbackButtonProps {
  restaurantId: string;
  initialUpvotes: number;
  initialDownvotes: number;
}

export default function RestaurantFeedbackButton({
  restaurantId,
  initialUpvotes,
  initialDownvotes,
}: RestaurantFeedbackButtonProps) {
  const storageKey = `restaurant-vote:${restaurantId}`;
  const [voted, setVoted] = useState<'up' | 'down' | null>(() => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(storageKey) as 'up' | 'down' | null) ?? null;
  });
  const [upvotes, setUpvotes] = useState(initialUpvotes ?? 0);
  const [downvotes, setDownvotes] = useState(initialDownvotes ?? 0);
  const [loading, setLoading] = useState(false);

  async function cast(direction: 'up' | 'down') {
    if (voted || loading) return;
    setLoading(true);

    if (direction === 'up') setUpvotes((v) => v + 1);
    else setDownvotes((v) => v + 1);
    setVoted(direction);

    try {
      const res = await fetch('/api/restaurant-vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurant_id: restaurantId, direction }),
      });

      if (res.ok) {
        const data = await res.json();
        setUpvotes(data.upvotes);
        setDownvotes(data.downvotes);
        localStorage.setItem(storageKey, direction);
      } else {
        if (direction === 'up') setUpvotes((v) => v - 1);
        else setDownvotes((v) => v - 1);
        setVoted(null);
      }
    } catch {
      if (direction === 'up') setUpvotes((v) => v - 1);
      else setDownvotes((v) => v - 1);
      setVoted(null);
    } finally {
      setLoading(false);
    }
  }

  const net = upvotes - downvotes;

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-gray-400 mr-1">Helpful?</span>
      <button
        onClick={() => cast('up')}
        disabled={!!voted || loading}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          voted === 'up'
            ? 'bg-green-100 text-green-700 cursor-default'
            : voted
            ? 'text-gray-300 cursor-default'
            : 'text-gray-500 hover:bg-gray-100 hover:text-green-600'
        }`}
        title="Yes, helpful"
      >
        <span>▲</span>
      </button>

      {upvotes === 0 && downvotes === 0 ? (
        <span className="text-xs text-gray-400">No votes yet</span>
      ) : (
        <span
          className={`text-sm font-medium tabular-nums ${
            net > 0 ? 'text-green-600' : net < 0 ? 'text-red-500' : 'text-gray-400'
          }`}
        >
          {net > 0 ? '+' : ''}
          {net}
        </span>
      )}

      <button
        onClick={() => cast('down')}
        disabled={!!voted || loading}
        className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
          voted === 'down'
            ? 'bg-red-100 text-red-600 cursor-default'
            : voted
            ? 'text-gray-300 cursor-default'
            : 'text-gray-500 hover:bg-gray-100 hover:text-red-500'
        }`}
        title="Not helpful"
      >
        <span>▼</span>
      </button>
    </div>
  );
}
