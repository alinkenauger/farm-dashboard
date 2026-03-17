'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FarmListing, FilterState } from '@/lib/types';
import ListingCard from './ListingCard';
import Filters from './Filters';

interface DashboardData {
  listings: FarmListing[];
  metadata: {
    lastUpdated: string;
    totalListings: number;
    stateBreakdown: Record<string, number>;
  };
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    states: [],
    minAcres: 200,
    maxAcres: 10000,
    minPrice: 0,
    maxPrice: 0,
    sortBy: 'date_newest',
  });

  const fetchListings = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);

      const res = await fetch(`/api/listings${refresh ? '?refresh=true' : ''}`);
      if (!res.ok) throw new Error('Failed to fetch listings');
      const result = await res.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError('Failed to load listings. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const filteredListings = useMemo(() => {
    if (!data?.listings) return [];

    let filtered = data.listings.filter((listing) => {
      // State filter
      if (filters.states.length > 0 && !filters.states.includes(listing.state)) return false;

      // Acreage filter
      if (listing.acreage < filters.minAcres) return false;
      if (filters.maxAcres > 0 && listing.acreage > filters.maxAcres) return false;

      // Price filter
      if (filters.minPrice > 0 && listing.price < filters.minPrice) return false;
      if (filters.maxPrice > 0 && listing.price > filters.maxPrice) return false;

      // Search filter
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const searchable = [
          listing.address,
          listing.city,
          listing.county,
          listing.state,
          listing.description,
        ]
          .join(' ')
          .toLowerCase();
        if (!searchable.includes(search)) return false;
      }

      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price_asc':
          return a.price - b.price;
        case 'price_desc':
          return b.price - a.price;
        case 'acres_asc':
          return a.acreage - b.acreage;
        case 'acres_desc':
          return b.acreage - a.acreage;
        case 'date_oldest':
          return new Date(a.dateListed).getTime() - new Date(b.dateListed).getTime();
        case 'date_newest':
        default:
          return new Date(b.dateListed).getTime() - new Date(a.dateListed).getTime();
      }
    });

    return filtered;
  }, [data?.listings, filters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Farm Listings</h2>
          <p className="text-gray-500 mt-2 text-sm">
            Searching across 10 states for farms 200+ acres with homes...
          </p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-700">{error}</h2>
          <button
            onClick={() => fetchListings()}
            className="mt-4 px-6 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Farm Finder</h1>
              <p className="text-xs text-gray-500">
                200+ acre farms with homes - 50%+ pasture
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {data?.metadata?.lastUpdated && (
              <span className="text-xs text-gray-400 hidden sm:inline">
                Updated {new Date(data.metadata.lastUpdated).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
            )}
            <button
              onClick={() => fetchListings(true)}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-green-700 hover:bg-green-800 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              <svg
                className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats bar */}
        {data?.metadata && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-green-700">{data.metadata.totalListings}</div>
              <div className="text-xs text-gray-500">Total Listings</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-blue-700">
                {Object.keys(data.metadata.stateBreakdown || {}).length}
              </div>
              <div className="text-xs text-gray-500">States</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-amber-700">200+</div>
              <div className="text-xs text-gray-500">Min Acres</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">50%+</div>
              <div className="text-xs text-gray-500">Pasture</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <Filters
          filters={filters}
          onChange={setFilters}
          totalCount={data?.listings?.length || 0}
          filteredCount={filteredListings.length}
        />

        {/* Listings grid */}
        {filteredListings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-600">No Listings Found</h3>
            <p className="text-gray-400 mt-1 text-sm">
              {data?.listings?.length === 0
                ? 'Click "Refresh" to search for farm listings.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>
            Farm Finder - Searching KY, MO, AR, IL, TN, MS, AL, GA, SC, FL for 200+ acre farms with homes and 50%+ pasture.
          </p>
          <p className="mt-1">
            Data sourced from public farm listing sites. Updated daily at 8:00 AM EST.
          </p>
        </div>
      </footer>
    </div>
  );
}
