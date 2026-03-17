import { NextRequest, NextResponse } from 'next/server';
import { scrapeAllStates } from '@/lib/scraper';
import { saveListings } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for scraping

export async function GET(request: NextRequest) {
  // Verify cron secret in production
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('Starting daily farm listing scrape...');
    const listings = await scrapeAllStates();

    if (listings.length > 0) {
      saveListings(listings);
      console.log(`Scraped ${listings.length} listings`);
    }

    return NextResponse.json({
      success: true,
      count: listings.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron scrape failed:', error);
    return NextResponse.json({ error: 'Scrape failed' }, { status: 500 });
  }
}
