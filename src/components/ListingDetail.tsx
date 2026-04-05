'use client';

import { useState } from 'react';
import { FarmListing } from '@/lib/types';

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(2)}M`;
  return `$${price.toLocaleString()}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysOnMarket(dateStr: string): number {
  if (!dateStr) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000));
}

export default function ListingDetail({ listing }: { listing: FarmListing }) {
  const [imgIndex, setImgIndex] = useState(0);
  const allImages = listing.images?.length > 0 ? listing.images : listing.imageUrl ? [listing.imageUrl] : [];
  const currentImage = allImages[imgIndex] || '';
  const hasMultiple = allImages.length > 1;
  const dom = daysOnMarket(listing.dateListed);

  const lastPriceChange = listing.priceHistory.length > 1
    ? listing.priceHistory[listing.priceHistory.length - 1]
    : null;

  const handleShare = async () => {
    const text = `${listing.address} - ${listing.acreage} acres - ${listing.price > 0 ? formatPrice(listing.price) : 'Price Not Listed'}`;
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: listing.address, text, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      alert('Link copied!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 text-green-700 hover:text-green-800">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Back to Map</span>
          </a>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* Photo gallery */}
        <div className="relative rounded-xl overflow-hidden bg-gray-100 mb-6" style={{ height: '400px' }}>
          {currentImage ? (
            <img
              src={currentImage}
              alt={listing.address}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}

          {hasMultiple && (
            <>
              <button
                onClick={() => setImgIndex((i) => (i - 1 + allImages.length) % allImages.length)}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg"
              >
                &lt;
              </button>
              <button
                onClick={() => setImgIndex((i) => (i + 1) % allImages.length)}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white w-10 h-10 rounded-full flex items-center justify-center text-lg"
              >
                &gt;
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded-full text-xs">
                {imgIndex + 1} / {allImages.length}
              </div>
            </>
          )}

          {/* Price badge */}
          <div className="absolute top-4 left-4 bg-green-700 text-white px-4 py-2 rounded-lg font-bold text-lg shadow-lg">
            {listing.price > 0 ? formatPrice(listing.price) : 'Price Not Listed'}
          </div>

          {/* Price drop badge */}
          {lastPriceChange && lastPriceChange.change < 0 && (
            <div className="absolute top-4 right-4 bg-red-500 text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg">
              Price Drop: {formatPrice(Math.abs(lastPriceChange.change))}
            </div>
          )}
        </div>

        {/* Thumbnail strip */}
        {allImages.length > 1 && (
          <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
            {allImages.map((img, i) => (
              <button
                key={i}
                onClick={() => setImgIndex(i)}
                className={`flex-shrink-0 w-20 h-14 rounded-lg overflow-hidden border-2 ${i === imgIndex ? 'border-green-700' : 'border-transparent'}`}
              >
                <img src={img} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Title and location */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{listing.address}</h1>
              <p className="text-gray-500 flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                {listing.city && `${listing.city}, `}{listing.county && `${listing.county} County, `}{listing.state}
              </p>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-green-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-green-800">{listing.acreage.toLocaleString()}</div>
                <div className="text-xs text-green-600 mt-1">Acres</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 text-center">
                <div className="text-2xl font-bold text-blue-800">
                  {listing.pricePerAcre > 0 ? `$${listing.pricePerAcre.toLocaleString()}` : 'N/A'}
                </div>
                <div className="text-xs text-blue-600 mt-1">Price per Acre</div>
              </div>
              {(listing.beds > 0 || listing.baths > 0) && (
                <>
                  <div className="bg-amber-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-amber-800">{listing.beds}</div>
                    <div className="text-xs text-amber-600 mt-1">Bedrooms</div>
                  </div>
                  <div className="bg-purple-50 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-800">{listing.baths}</div>
                    <div className="text-xs text-purple-600 mt-1">Bathrooms</div>
                  </div>
                </>
              )}
            </div>

            {/* Description */}
            {listing.description && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">About This Property</h2>
                <p className="text-gray-600 leading-relaxed">{listing.description}</p>
              </div>
            )}

            {/* Price history */}
            {listing.priceHistory.length > 1 && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Price History</h2>
                <div className="space-y-2">
                  {listing.priceHistory.map((ph, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">{formatDate(ph.date)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{formatPrice(ph.price)}</span>
                        {ph.change !== 0 && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${ph.change < 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {ph.change < 0 ? '' : '+'}{formatPrice(Math.abs(ph.change))}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Action buttons */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
              <a
                href={listing.listingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center bg-green-700 hover:bg-green-800 text-white py-3 rounded-lg font-semibold transition-colors"
              >
                View Original Listing
              </a>
              <button
                onClick={handleShare}
                className="block w-full text-center border border-gray-300 hover:border-green-500 hover:text-green-700 text-gray-600 py-3 rounded-lg font-medium transition-colors"
              >
                Share This Property
              </button>
            </div>

            {/* Property details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">Property Details</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Listed</span>
                  <span className="text-gray-900 font-medium">{formatDate(listing.dateListed)}</span>
                </div>
                {dom > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Days on Market</span>
                    <span className="text-gray-900 font-medium">{dom} days</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Taxes</span>
                  <span className="text-gray-900 font-medium">{listing.taxes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Utilities</span>
                  <span className="text-gray-900 font-medium">{listing.utilities}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="text-gray-900 font-medium">{listing.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Updated</span>
                  <span className="text-gray-900 font-medium">{formatDate(listing.lastUpdated)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
