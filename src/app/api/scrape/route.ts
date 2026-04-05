import { NextResponse } from 'next/server';
import { scrapeStates } from '@/lib/scraper';
import { FarmListing, TARGET_STATES } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Scrape all states and return results as JSON.
 * Used by the local scrape-and-push script.
 */
export async function GET() {
  const startTime = Date.now();

  try {
    console.log('Starting scrape of all states...');
    const listings = await scrapeStates([...TARGET_STATES]);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    const stateBreakdown: Record<string, number> = {};
    listings.forEach((l: FarmListing) => {
      stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
    });

    return NextResponse.json({
      listings,
      metadata: {
        lastUpdated: new Date().toISOString(),
        totalListings: listings.length,
        stateBreakdown,
        scrapeDurationSeconds: parseFloat(elapsed),
      },
    });
  } catch (error) {
    console.error('Scrape failed:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
