'use client';

import { FarmListing } from '@/lib/types';

function formatPrice(price: number): string {
  if (price >= 1_000_000) {
    return `$${(price / 1_000_000).toFixed(2)}M`;
  }
  return `$${price.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ListingCard({ listing }: { listing: FarmListing }) {
  const lastPriceChange = listing.priceHistory.length > 1
    ? listing.priceHistory[listing.priceHistory.length - 1]
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="relative h-48 bg-gray-100">
        {listing.imageUrl ? (
          <img
            src={listing.imageUrl}
            alt={listing.address}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'data:image/svg+xml,' + encodeURIComponent(
                '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" fill="%23e5e7eb"><rect width="400" height="200"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="%239ca3af" font-family="sans-serif" font-size="16">No Image Available</text></svg>'
              );
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {/* Price badge */}
        <div className="absolute top-3 left-3 bg-green-700 text-white px-3 py-1 rounded-lg font-bold text-sm shadow">
          {listing.price > 0 ? formatPrice(listing.price) : 'Price Not Listed'}
        </div>
        {/* Price drop badge */}
        {lastPriceChange && lastPriceChange.change < 0 && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-semibold shadow flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Price Drop: {formatPrice(Math.abs(lastPriceChange.change))}
          </div>
        )}
        {/* Source badge */}
        <div className="absolute bottom-3 right-3 bg-black/60 text-white px-2 py-0.5 rounded text-xs">
          {listing.source}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
            {listing.address}
          </h3>
        </div>

        <div className="flex items-center gap-1 text-gray-500 text-xs mb-3">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {listing.city && `${listing.city}, `}{listing.county && `${listing.county} County, `}{listing.state}
        </div>

        {/* Key stats */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="bg-green-50 rounded-lg p-2 text-center">
            <div className="text-green-800 font-bold text-sm">{listing.acreage.toLocaleString()}</div>
            <div className="text-green-600 text-xs">Acres</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <div className="text-blue-800 font-bold text-sm">
              {listing.pricePerAcre > 0 ? `$${listing.pricePerAcre.toLocaleString()}` : 'N/A'}
            </div>
            <div className="text-blue-600 text-xs">Per Acre</div>
          </div>
          <div className="bg-amber-50 rounded-lg p-2 text-center">
            <div className="text-amber-800 font-bold text-sm flex items-center justify-center gap-0.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
              </svg>
              Yes
            </div>
            <div className="text-amber-600 text-xs">House</div>
          </div>
        </div>

        {/* Description */}
        {listing.description && (
          <p className="text-gray-600 text-xs leading-relaxed line-clamp-3 mb-3">
            {listing.description}
          </p>
        )}

        {/* Details */}
        <div className="space-y-1 text-xs text-gray-500 mb-3 border-t border-gray-100 pt-3">
          <div className="flex justify-between">
            <span>Listed</span>
            <span className="text-gray-700">{formatDate(listing.dateListed)}</span>
          </div>
          {listing.priceHistory.length > 1 && (
            <div className="flex justify-between">
              <span>Price Changes</span>
              <span className="text-gray-700">{listing.priceHistory.length - 1}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Taxes</span>
            <span className="text-gray-700">{listing.taxes}</span>
          </div>
          <div className="flex justify-between">
            <span>Utilities</span>
            <span className="text-gray-700">{listing.utilities}</span>
          </div>
        </div>

        {/* CTA */}
        <a
          href={listing.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium transition-colors"
        >
          View Listing
        </a>
      </div>
    </div>
  );
}
