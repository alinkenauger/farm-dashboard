#!/bin/bash
# Scrape farm listings via Next.js dev server and push to GitHub.
# Vercel redeploys when data/listings.json changes.
#
# Run manually:  ./scripts/scrape-and-push.sh
# Mac launchd runs this daily at 7am.

set -e
cd "$(dirname "$0")/.."

export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

echo "$(date): Starting farm scrape..."

PORT=3847

# Start Next.js dev server in background
npx next dev -p $PORT &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

# Wait for server to be ready
echo "Waiting for dev server..."
for i in $(seq 1 30); do
  if curl -s "http://localhost:$PORT/api/listings" > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Hit the scrape endpoint
echo "$(date): Scraping all states..."
curl -s "http://localhost:$PORT/api/scrape" > data/listings.json.tmp

# Check if we got listings
COUNT=$(python3 -c "import json; print(json.load(open('data/listings.json.tmp'))['metadata']['totalListings'])" 2>/dev/null || echo "0")

if [ "$COUNT" -eq "0" ]; then
  echo "$(date): Scrape returned 0 listings. Skipping."
  rm -f data/listings.json.tmp
  exit 0
fi

mv data/listings.json.tmp data/listings.json
echo "$(date): Got $COUNT listings."

# Kill dev server
kill $SERVER_PID 2>/dev/null || true

# Push to GitHub
git add data/listings.json
if git diff --staged --quiet; then
  echo "$(date): No changes to listings. Done."
else
  git commit -m "data: update farm listings $(date +%Y-%m-%d) ($COUNT listings)"
  git push origin main
  echo "$(date): Pushed. Vercel will redeploy."
fi

echo "$(date): Done."
