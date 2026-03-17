'use client';

import { FilterState, TARGET_STATES } from '@/lib/types';

interface FiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}

export default function Filters({ filters, onChange, totalCount, filteredCount }: FiltersProps) {
  const update = (partial: Partial<FilterState>) => {
    onChange({ ...filters, ...partial });
  };

  const toggleState = (state: string) => {
    const states = filters.states.includes(state)
      ? filters.states.filter((s) => s !== state)
      : [...filters.states, state];
    update({ states });
  };

  const clearFilters = () => {
    onChange({
      search: '',
      states: [],
      minAcres: 200,
      maxAcres: 10000,
      minPrice: 0,
      maxPrice: 0,
      sortBy: 'date_newest',
    });
  };

  const hasActiveFilters =
    filters.search ||
    filters.states.length > 0 ||
    filters.minAcres > 200 ||
    filters.maxAcres < 10000 ||
    filters.minPrice > 0 ||
    filters.maxPrice > 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search by location, county, or keywords..."
            value={filters.search}
            onChange={(e) => update({ search: e.target.value })}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
        <select
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as FilterState['sortBy'] })}
          className="px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
        >
          <option value="date_newest">Newest First</option>
          <option value="date_oldest">Oldest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="acres_asc">Acres: Low to High</option>
          <option value="acres_desc">Acres: High to Low</option>
        </select>
      </div>

      {/* State filters */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
          Filter by State
        </label>
        <div className="flex flex-wrap gap-2">
          {TARGET_STATES.map((state) => (
            <button
              key={state}
              onClick={() => toggleState(state)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filters.states.length === 0 || filters.states.includes(state)
                  ? 'bg-green-100 text-green-800 hover:bg-green-200'
                  : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
              }`}
            >
              {state}
            </button>
          ))}
        </div>
      </div>

      {/* Range filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min Acres</label>
          <input
            type="number"
            value={filters.minAcres}
            onChange={(e) => update({ minAcres: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            min={0}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Acres</label>
          <input
            type="number"
            value={filters.maxAcres || ''}
            onChange={(e) => update({ maxAcres: parseInt(e.target.value) || 0 })}
            placeholder="No max"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            min={0}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Min Price</label>
          <input
            type="number"
            value={filters.minPrice || ''}
            onChange={(e) => update({ minPrice: parseInt(e.target.value) || 0 })}
            placeholder="No min"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            min={0}
            step={50000}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Max Price</label>
          <input
            type="number"
            value={filters.maxPrice || ''}
            onChange={(e) => update({ maxPrice: parseInt(e.target.value) || 0 })}
            placeholder="No max"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            min={0}
            step={50000}
          />
        </div>
      </div>

      {/* Results count and clear */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          Showing <span className="font-semibold text-gray-800">{filteredCount}</span> of{' '}
          <span className="font-semibold text-gray-800">{totalCount}</span> listings
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-red-500 hover:text-red-700 text-xs font-medium"
          >
            Clear All Filters
          </button>
        )}
      </div>
    </div>
  );
}
