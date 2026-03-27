import SearchBar from '@/components/SearchBar';
import CategoryPills from '@/components/CategoryPills';
import TrendingSection from '@/components/TrendingSection';

export default function HomePage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Find great local spots</h1>
        <p className="text-gray-500">
          Search restaurant recommendations from Reddit and local food communities
        </p>
      </div>

      <SearchBar autoDetectCity />
      <CategoryPills />

      <TrendingSection />
    </div>
  );
}
