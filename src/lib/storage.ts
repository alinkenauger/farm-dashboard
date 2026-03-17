import { FarmListing } from './types';

// In-memory cache for serverless environment
let cachedListings: FarmListing[] = [];
let cachedMetadata: Metadata | null = null;
let lastFetchTime = 0;

// Cache duration: 1 hour (data refreshes via cron daily)
const CACHE_DURATION = 60 * 60 * 1000;

interface Metadata {
  lastUpdated: string;
  totalListings: number;
  stateBreakdown: Record<string, number>;
}

export function saveListings(listings: FarmListing[]): void {
  // Merge with existing to preserve price history
  const existingMap = new Map(cachedListings.map((l) => [l.listingUrl, l]));

  const merged = listings.map((listing) => {
    const prev = existingMap.get(listing.listingUrl);
    if (prev) {
      if (prev.price !== listing.price && listing.price > 0) {
        listing.priceHistory = [
          ...prev.priceHistory,
          {
            date: new Date().toISOString().split('T')[0],
            price: listing.price,
            change: listing.price - prev.price,
          },
        ];
      } else {
        listing.priceHistory = prev.priceHistory;
      }
      listing.dateListed = prev.dateListed;
    }
    return listing;
  });

  cachedListings = merged;
  lastFetchTime = Date.now();

  const stateBreakdown: Record<string, number> = {};
  merged.forEach((l) => {
    stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
  });

  cachedMetadata = {
    lastUpdated: new Date().toISOString(),
    totalListings: merged.length,
    stateBreakdown,
  };
}

export function loadListings(): FarmListing[] {
  return cachedListings;
}

export function loadMetadata(): Metadata | null {
  return cachedMetadata;
}

export function isCacheStale(): boolean {
  return Date.now() - lastFetchTime > CACHE_DURATION;
}
