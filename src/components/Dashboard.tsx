'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { FarmListing, FilterState } from '@/lib/types';
import ListingCard from './ListingCard';
import Filters from './Filters';

const MapView = dynamic(() => import('./MapView'), { ssr: false });

interface DashboardData {
  listings: FarmListing[];
  metadata: {
    lastUpdated: string;
    totalListings: number;
    stateBreakdown: Record<string, number>;
  };
}

function getFavoritesFromUrl(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const params = new URLSearchParams(window.location.search);
  const favs = params.get('favorites');
  return favs ? new Set(favs.split(',').filter(Boolean)) : new Set();
}

function setFavoritesInUrl(favs: Set<string>) {
  const params = new URLSearchParams(window.location.search);
  if (favs.size > 0) {
    params.set('favorites', [...favs].join(','));
  } else {
    params.delete('favorites');
  }
  const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newUrl);
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('map');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [compareList, setCompareList] = useState<FarmListing[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  const [selectedListing, setSelectedListing] = useState<FarmListing | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    states: [],
    minAcres: 200,
    maxAcres: 600,
    minPrice: 0,
    maxPrice: 0,
    sortBy: 'date_newest',
  });

  // Load favorites from URL params
  useEffect(() => {
    setFavorites(getFavoritesFromUrl());
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setFavoritesInUrl(next);
      return next;
    });
  }, []);

  const toggleCompare = useCallback((listing: FarmListing) => {
    setCompareList((prev) => {
      const exists = prev.find((l) => l.id === listing.id);
      if (exists) return prev.filter((l) => l.id !== listing.id);
      if (prev.length >= 3) return prev;
      return [...prev, listing];
    });
  }, []);

  // Load listings from static JSON via API
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/listings');
        if (!res.ok) throw new Error('Failed to fetch listings');
        const result = await res.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError('Failed to load listings. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredListings = useMemo(() => {
    if (!data?.listings) return [];

    let filtered = data.listings.filter((listing) => {
      if (filters.states.length > 0 && !filters.states.includes(listing.state)) return false;
      if (listing.acreage < filters.minAcres) return false;
      if (filters.maxAcres > 0 && listing.acreage > filters.maxAcres) return false;
      if (filters.minPrice > 0 && listing.price < filters.minPrice) return false;
      if (filters.maxPrice > 0 && listing.price > filters.maxPrice) return false;

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
        case 'ppa_asc':
          return (a.pricePerAcre || Infinity) - (b.pricePerAcre || Infinity);
        case 'ppa_desc':
          return (b.pricePerAcre || 0) - (a.pricePerAcre || 0);
        case 'date_oldest':
          return new Date(a.dateListed).getTime() - new Date(b.dateListed).getTime();
        case 'date_newest':
        default:
          return new Date(b.dateListed).getTime() - new Date(a.dateListed).getTime();
      }
    });

    return filtered;
  }, [data?.listings, filters]);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-700">Loading Farm Listings</h2>
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
            onClick={() => window.location.reload()}
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
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-700 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Farm Finder</h1>
              <p className="text-xs text-gray-500">
                200+ acre farms across 12 states
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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

            {/* View toggle */}
            <div className="flex border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('map')}
                className={`px-3 py-2 text-xs font-medium ${viewMode === 'map' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-2 text-xs font-medium ${viewMode === 'grid' ? 'bg-green-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
              </button>
            </div>
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
              <div className="text-2xl font-bold text-amber-700">{filteredListings.length}</div>
              <div className="text-xs text-gray-500">Matching Filters</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-purple-700">{favorites.size}</div>
              <div className="text-xs text-gray-500">Favorites</div>
            </div>
          </div>
        )}

        {/* Compare bar */}
        {compareList.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-blue-800">
                Compare ({compareList.length}/3)
              </h3>
              <div className="flex gap-2">
                {compareList.length >= 2 && (
                  <button
                    onClick={() => setShowCompare(!showCompare)}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium"
                  >
                    {showCompare ? 'Hide' : 'Show'} Comparison
                  </button>
                )}
                <button
                  onClick={() => { setCompareList([]); setShowCompare(false); }}
                  className="px-3 py-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded text-xs font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="flex gap-2">
              {compareList.map((l) => (
                <div key={l.id} className="bg-white rounded-lg px-3 py-2 text-xs border border-blue-200 flex items-center gap-2">
                  <span className="font-medium text-gray-800 truncate max-w-[120px]">{l.address}</span>
                  <button onClick={() => toggleCompare(l)} className="text-gray-400 hover:text-red-500">&times;</button>
                </div>
              ))}
            </div>
            {showCompare && compareList.length >= 2 && (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-blue-200">
                      <th className="text-left py-2 pr-4 text-blue-700">Detail</th>
                      {compareList.map((l) => (
                        <th key={l.id} className="text-left py-2 pr-4 text-blue-700 min-w-[140px]">{l.address.slice(0, 25)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="text-gray-700">
                    {[
                      ['Price', (l: FarmListing) => l.price > 0 ? `$${l.price.toLocaleString()}` : 'N/A'],
                      ['Acres', (l: FarmListing) => l.acreage.toLocaleString()],
                      ['$/Acre', (l: FarmListing) => l.pricePerAcre > 0 ? `$${l.pricePerAcre.toLocaleString()}` : 'N/A'],
                      ['Beds/Baths', (l: FarmListing) => l.beds || l.baths ? `${l.beds}bd / ${l.baths}ba` : 'N/A'],
                      ['State', (l: FarmListing) => l.state],
                      ['County', (l: FarmListing) => l.county || 'N/A'],
                      ['Source', (l: FarmListing) => l.source],
                    ].map(([label, fn]) => (
                      <tr key={label as string} className="border-b border-blue-100">
                        <td className="py-2 pr-4 font-medium">{label as string}</td>
                        {compareList.map((l) => (
                          <td key={l.id} className="py-2 pr-4">{(fn as (l: FarmListing) => string)(l)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <Filters
          filters={filters}
          onChange={setFilters}
          totalCount={data?.listings?.length || 0}
          filteredCount={filteredListings.length}
          stateBreakdown={data?.metadata?.stateBreakdown}
        />

        {/* Content */}
        {filteredListings.length > 0 ? (
          viewMode === 'map' ? (
            <div className="relative flex gap-0">
              <div className={`${selectedListing ? 'w-2/3' : 'w-full'} transition-all duration-300`}>
                <MapView listings={filteredListings} onSelectListing={setSelectedListing} />
              </div>
              {selectedListing && (
                <div className="w-1/3 min-w-[340px] max-w-[420px] bg-white border-l border-gray-200 rounded-r-xl overflow-y-auto" style={{ height: '700px' }}>
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center justify-between z-10">
                    <span className="text-xs font-medium text-gray-500">Property Details</span>
                    <button onClick={() => setSelectedListing(null)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
                  </div>
                  <ListingCard
                    listing={selectedListing}
                    isFavorite={favorites.has(selectedListing.id)}
                    onToggleFavorite={toggleFavorite}
                    onCompare={toggleCompare}
                  />
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredListings.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  isFavorite={favorites.has(listing.id)}
                  onToggleFavorite={toggleFavorite}
                  onCompare={toggleCompare}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-16">
            <svg className="w-16 h-16 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-600">No Listings Found</h3>
            <p className="text-gray-400 mt-1 text-sm">
              {data?.listings?.length === 0
                ? 'Listings are updated daily. Check back soon.'
                : 'Try adjusting your filters to see more results.'}
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white mt-12 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-xs text-gray-400">
          <p>
            Farm Finder - Searching 12 states for 200+ acre farms.
          </p>
          <p className="mt-1">
            Data sourced from LandWatch, Land & Farm, Land.com, Lands of America.
          </p>
        </div>
      </footer>
    </div>
  );
}
