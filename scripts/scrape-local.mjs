/**
 * Local scraper that hits the Next.js API route.
 * Runs the dev server briefly, triggers a scrape, saves the result.
 *
 * Usage: node scripts/scrape-local.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PORT = 3847;

// Start next dev on a random port
console.log('Starting Next.js dev server...');
const server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
  cwd: ROOT,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, NODE_ENV: 'development' },
});

let serverOutput = '';
server.stdout.on('data', (d) => { serverOutput += d.toString(); });
server.stderr.on('data', (d) => { serverOutput += d.toString(); });

// Wait for server to be ready
async function waitForServer(maxWait = 30000) {
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(`http://localhost:${PORT}/api/listings`);
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  try {
    const ready = await waitForServer();
    if (!ready) {
      console.error('Server failed to start. Output:', serverOutput.slice(-500));
      process.exit(1);
    }

    console.log('Server ready. Fetching listings...');
    const res = await fetch(`http://localhost:${PORT}/api/listings`);
    const data = await res.json();

    const count = data.metadata?.totalListings || 0;
    console.log(`Got ${count} listings`);

    if (count > 0) {
      const outDir = join(ROOT, 'data');
      mkdirSync(outDir, { recursive: true });
      writeFileSync(join(outDir, 'listings.json'), JSON.stringify(data));
      console.log('Written to data/listings.json');

      for (const [state, n] of Object.entries(data.metadata.stateBreakdown || {}).sort((a, b) => b[1] - a[1])) {
        console.log(`  ${state}: ${n}`);
      }
    }
  } finally {
    server.kill();
  }
}

main().catch(err => { console.error(err); server.kill(); process.exit(1); });
