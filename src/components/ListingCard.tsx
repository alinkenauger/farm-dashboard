'use client';

import { useState } from 'react';
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

function daysOnMarket(dateStr: string): number {
  if (!dateStr) return 0;
  const listed = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - listed) / (1000 * 60 * 60 * 24)));
}

interface ListingCardProps {
  listing: FarmListing;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  onCompare?: (listing: FarmListing) => void;
}

export default function ListingCard({ listing, isFavorite, onToggleFavorite, onCompare }: ListingCardProps) {
  const [imgIndex, setImgIndex] = useState(0);
  const allImages = listing.images?.length > 0 ? listing.images : listing.imageUrl ? [listing.imageUrl] : [];
  const currentImage = allImages[imgIndex] || '';
  const hasMultiple = allImages.length > 1;

  const lastPriceChange = listing.priceHistory.length > 1
    ? listing.priceHistory[listing.priceHistory.length - 1]
    : null;

  const dom = daysOnMarket(listing.dateListed);

  const handleShare = async () => {
    const text = `${listing.address} - ${listing.acreage} acres - ${listing.price > 0 ? formatPrice(listing.price) : 'Price Not Listed'}\n${listing.listingUrl}`;
    if (navigator.share) {
      try { await navigator.share({ title: listing.address, text, url: listing.listingUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      alert('Link copied to clipboard!');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Image carousel */}
      <div className="relative h-48 bg-gray-100">
        {currentImage ? (
          <img
            src={currentImage}
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

        {/* Carousel arrows */}
        {hasMultiple && (
          <>
            <button
              onClick={(e) => { e.preventDefault(); setImgIndex((i) => (i - 1 + allImages.length) % allImages.length); }}
              className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm"
            >
              &lt;
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setImgIndex((i) => (i + 1) % allImages.length); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-7 h-7 rounded-full flex items-center justify-center text-sm"
            >
              &gt;
            </button>
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-1">
              {allImages.slice(0, 5).map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === imgIndex ? 'bg-white' : 'bg-white/50'}`} />
              ))}
              {allImages.length > 5 && <span className="text-white text-[10px] ml-1">+{allImages.length - 5}</span>}
            </div>
          </>
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
        {/* Source + DOM badges */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5">
          {dom > 0 && (
            <span className="bg-black/60 text-white px-2 py-0.5 rounded text-xs">{dom}d on market</span>
          )}
          <span className="bg-black/60 text-white px-2 py-0.5 rounded text-xs">{listing.source}</span>
        </div>

        {/* Favorite + Share buttons */}
        <div className="absolute bottom-3 left-3 flex items-center gap-1.5">
          {onToggleFavorite && (
            <button
              onClick={(e) => { e.preventDefault(); onToggleFavorite(listing.id); }}
              className="bg-white/90 hover:bg-white p-1.5 rounded-full shadow"
            >
              <svg className={`w-4 h-4 ${isFavorite ? 'text-red-500 fill-red-500' : 'text-gray-500'}`} fill={isFavorite ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </button>
          )}
          <button
            onClick={(e) => { e.preventDefault(); handleShare(); }}
            className="bg-white/90 hover:bg-white p-1.5 rounded-full shadow"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
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
            <div className="text-amber-800 font-bold text-sm">
              {listing.beds > 0 || listing.baths > 0
                ? `${listing.beds}bd/${listing.baths}ba`
                : 'Yes'}
            </div>
            <div className="text-amber-600 text-xs">{listing.beds > 0 || listing.baths > 0 ? 'Bed/Bath' : 'House'}</div>
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
          {dom > 0 && (
            <div className="flex justify-between">
              <span>Days on Market</span>
              <span className="text-gray-700">{dom}</span>
            </div>
          )}
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

        {/* CTAs */}
        <div className="flex gap-2">
          <a
            href={`/listing/${encodeURIComponent(listing.id)}`}
            className="flex-1 text-center bg-green-700 hover:bg-green-800 text-white py-2 rounded-lg text-sm font-medium transition-colors"
          >
            View Details
          </a>
          {onCompare && (
            <button
              onClick={() => onCompare(listing)}
              className="px-3 py-2 border border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 rounded-lg text-sm transition-colors"
              title="Compare"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
