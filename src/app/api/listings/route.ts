import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllStates } from '@/lib/scraper';
import { seedListings } from '@/lib/seed-data';
import { FarmListing } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

// Simple in-memory cache
let cachedListings: FarmListing[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const refresh = searchParams.get('refresh') === 'true';

  // Return cached if fresh
  if (cachedListings && !refresh && Date.now() - cacheTime < CACHE_TTL) {
    return NextResponse.json({
      listings: cachedListings,
      metadata: buildMetadata(cachedListings),
    });
  }

  // Try scraping fresh data
  if (refresh) {
    try {
      const scraped = await scrapeAllStates();
      if (scraped.length > 0) {
        // Merge with existing
        cachedListings = mergeListings(cachedListings || seedListings, scraped);
        cacheTime = Date.now();
        return NextResponse.json({
          listings: cachedListings,
          metadata: buildMetadata(cachedListings),
        });
      }
    } catch (error) {
      console.error('Scrape error:', error);
    }
  }

  // Fall back to seed data
  if (!cachedListings) {
    cachedListings = seedListings;
    cacheTime = Date.now();
  }

  return NextResponse.json({
    listings: cachedListings,
    metadata: buildMetadata(cachedListings),
  });
}

function mergeListings(existing: FarmListing[], fresh: FarmListing[]): FarmListing[] {
  const map = new Map(existing.map((l) => [l.id, l]));

  for (const listing of fresh) {
    const prev = map.get(listing.id);
    if (prev) {
      // Track price changes
      if (prev.price !== listing.price && listing.price > 0) {
        listing.priceHistory = [
          ...prev.priceHistory,
          { date: new Date().toISOString().split('T')[0], price: listing.price, change: listing.price - prev.price },
        ];
      } else {
        listing.priceHistory = prev.priceHistory;
      }
      listing.dateListed = prev.dateListed;
    }
    map.set(listing.id, listing);
  }

  return Array.from(map.values());
}

function buildMetadata(listings: FarmListing[]) {
  const stateBreakdown: Record<string, number> = {};
  listings.forEach((l) => {
    stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
  });

  return {
    lastUpdated: new Date().toISOString(),
    totalListings: listings.length,
    stateBreakdown,
  };
}
