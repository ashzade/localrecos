interface Recommendation {
  id: string;
  source: string;
  post_url: string;
  summary: string;
  mention_count: number;
  scraped_at: string | Date;
}

interface RecommendationCardProps {
  recommendation: Recommendation;
}

export default function RecommendationCard({ recommendation: rec }: RecommendationCardProps) {
  const date = new Date(rec.scraped_at);
  const dateStr = date.toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">{rec.summary}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-gray-400">
        <span className="font-medium text-gray-500">{rec.source}</span>
        {rec.mention_count > 1 && (
          <span>{rec.mention_count} mentions</span>
        )}
        <span>{dateStr}</span>
        <a
          href={rec.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:underline"
        >
          View post
        </a>
      </div>
    </div>
  );
}
