'use client';

import { useRouter, useSearchParams } from 'next/navigation';

const SORT_OPTIONS = [
  { value: 'votes', label: 'Votes' },
  { value: 'price', label: 'Price' },
  { value: 'distance', label: 'Distance', disabled: true },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]['value'];

export default function SortBar({ current }: { current: SortValue }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setSort(value: SortValue) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('sort', value);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center gap-2 mt-5">
      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Sort</span>
      <div className="flex gap-1">
        {SORT_OPTIONS.map((opt) => {
          const active = current === opt.value;
          if (opt.disabled) {
            return (
              <span
                key={opt.value}
                title="Requires location data — coming soon"
                className="px-3 py-1 text-xs rounded-full border border-dashed border-gray-200 text-gray-300 cursor-not-allowed"
              >
                {opt.label}
              </span>
            );
          }
          return (
            <button
              key={opt.value}
              onClick={() => setSort(opt.value)}
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                active
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
