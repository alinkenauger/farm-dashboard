/**
 * Standalone scraper script for GitHub Actions CI.
 * Runs all scrapers and outputs data/listings.json.
 *
 * Usage: npx tsx scripts/scrape.ts
 */

import { scrapeStates } from '../src/lib/scraper';
import { TARGET_STATES } from '../src/lib/types';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

async function main() {
  const startTime = Date.now();
  console.log(`Starting scrape of ${TARGET_STATES.length} states...`);

  const listings = await scrapeStates([...TARGET_STATES]);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`Scrape complete: ${listings.length} listings in ${elapsed}s`);

  // Build metadata
  const stateBreakdown: Record<string, number> = {};
  for (const l of listings) {
    stateBreakdown[l.state] = (stateBreakdown[l.state] || 0) + 1;
  }

  const output = {
    listings,
    metadata: {
      lastUpdated: new Date().toISOString(),
      totalListings: listings.length,
      stateBreakdown,
      scrapeDurationSeconds: parseFloat(elapsed),
    },
  };

  const outDir = join(process.cwd(), 'data');
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, 'listings.json');
  writeFileSync(outPath, JSON.stringify(output));
  console.log(`Written to ${outPath} (${(JSON.stringify(output).length / 1024).toFixed(0)} KB)`);

  // Summary by state
  for (const [state, count] of Object.entries(stateBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${state}: ${count}`);
  }
}

main().catch((err) => {
  console.error('Scrape failed:', err);
  process.exit(1);
});
