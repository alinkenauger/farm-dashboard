/**
 * Scheduled scraper for GitHub Actions CI.
 * Scrapes 4 states per day on rotation to stay within ScraperAPI free tier.
 * Merges with existing data so all 12 states accumulate over 3 days.
 *
 * Usage: npx tsx scripts/scrape.ts
 */

import { scrapeStates } from '../src/lib/scraper';
import { TARGET_STATES, FarmListing } from '../src/lib/types';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Rotate 3 states per day. With 9 states, full cycle every 3 days.
// Pass --all flag to scrape all states at once (initial load).
function getTodaysStates(): string[] {
  if (process.argv.includes('--all')) {
    console.log('--all flag: scraping all states');
    return [...TARGET_STATES];
  }
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const rotation = dayOfYear % 3; // 0, 1, or 2
  const start = rotation * 3;
  return [...TARGET_STATES].slice(start, start + 3);
}

async function main() {
  const states = getTodaysStates();
  const startTime = Date.now();
  console.log(`Today's rotation: ${states.join(', ')} (4 of ${TARGET_STATES.length})`);

  const freshListings = await scrapeStates(states);
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Scraped ${freshListings.length} listings in ${elapsed}s`);

  // Load existing data and merge
  const outDir = join(process.cwd(), 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'listings.json');

  let existingListings: FarmListing[] = [];
  if (existsSync(outPath)) {
    try {
      const raw = readFileSync(outPath, 'utf-8');
      const existing = JSON.parse(raw);
      existingListings = existing.listings || [];
      console.log(`Loaded ${existingListings.length} existing listings`);
    } catch {
      console.log('Could not read existing listings, starting fresh');
    }
  }

  // Merge: replace listings from today's states, keep others
  const todaysStateSet = new Set(states);
  const keptListings = existingListings.filter(l => !todaysStateSet.has(l.state));
  const allListings = [...keptListings, ...freshListings];

  // Deduplicate by URL
  const seen = new Map<string, FarmListing>();
  for (const listing of allListings) {
    seen.set(listing.listingUrl, listing);
  }
  const deduped = Array.from(seen.values());

  // Build metadata
  const stateBreakdown: Record<string, number> = {};
  for (const l of deduped) {
    stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
  }

  const output = {
    listings: deduped,
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalListings: deduped.length,
      stateBreakdown,
      scrapeDurationSeconds: parseFloat(elapsed),
      statesScrapedToday: states,
    },
  };

  writeFileSync(outPath, JSON.stringify(output));
  console.log(`Written ${deduped.length} total listings (${freshListings.length} fresh + ${keptListings.length} kept)`);

  for (const [state, count] of Object.entries(stateBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${state}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
