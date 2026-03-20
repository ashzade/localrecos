'use client';

import { useState } from 'react';

interface VoteButtonProps {
  recommendationId: string;
  initialUpvotes: number;
  initialDownvotes: number;
}

export default function VoteButton({
  recommendationId,
  initialUpvotes,
  initialDownvotes,
}: VoteButtonProps) {
  const storageKey = `vote:${recommendationId}`;
  const [voted, setVoted] = useState<'up' | 'down' | null>(() => {
    if (typeof window === 'undefined') return null;
    return (localStorage.getItem(storageKey) as 'up' | 'down' | null) ?? null;
  });
  const [upvotes, setUpvotes] = useState(initialUpvotes);
  const [downvotes, setDownvotes] = useState(initialDownvotes);
  const [loading, setLoading] = useState(false);

  async function cast(direction: 'up' | 'down') {
    if (voted || loading) return;
    setLoading(true);

    // Optimistic update
    if (direction === 'up') setUpvotes((v) => v + 1);
    else setDownvotes((v) => v + 1);
    setVoted(direction);

    try {
      const res = await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recommendation_id: recommendationId, direction }),
      });

      if (res.ok) {
        const data = await res.json();
        setUpvotes(data.upvotes);
        setDownvotes(data.downvotes);
        localStorage.setItem(storageKey, direction);
      } else {
        // Revert on error
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
    <div className="flex items-center gap-2">
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
        title="Upvote"
      >
        <span>▲</span>
        <span>{upvotes}</span>
      </button>

      <span
        className={`text-sm font-medium tabular-nums ${
          net > 0 ? 'text-green-600' : net < 0 ? 'text-red-500' : 'text-gray-400'
        }`}
      >
        {net > 0 ? '+' : ''}
        {net}
      </span>

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
        title="Downvote"
      >
        <span>▼</span>
        <span>{downvotes}</span>
      </button>
    </div>
  );
}
