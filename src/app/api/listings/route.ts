import { NextResponse } from 'next/server';
import { FarmListing } from '@/lib/types';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

/**
 * Serve listings from the static JSON file produced by the CI scraper.
 * Falls back to seed data if the JSON hasn't been generated yet.
 */
export async function GET() {
  const dataPath = join(process.cwd(), 'data', 'listings.json');

  if (existsSync(dataPath)) {
    try {
      const raw = readFileSync(dataPath, 'utf-8');
      const data = JSON.parse(raw);
      return NextResponse.json(data);
    } catch (err) {
      console.error('Failed to read listings.json:', err);
    }
  }

  // Fallback: import seed data
  const { seedListings } = await import('@/lib/seed-data');
  const stateBreakdown: Record<string, number> = {};
  seedListings.forEach((l: FarmListing) => {
    stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
  });

  return NextResponse.json({
    listings: seedListings,
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalListings: seedListings.length,
      stateBreakdown,
      source: 'seed-data',
    },
  });
}
