import * as cheerio from 'cheerio';
import { FarmListing, STATE_ABBREVIATIONS } from './types';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function generateId(source: string, key: string): string {
  return `${source}-${Buffer.from(key).toString('base64').slice(0, 16)}`;
}

function parsePrice(text: string): number {
  const match = text.replace(/,/g, '').match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function parseAcreage(text: string): number {
  const match = text.replace(/,/g, '').match(/([\d.]+)\s*(?:acres?|ac)/i);
  return match ? parseFloat(match[1]) : 0;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function makeListing(
  partial: Partial<FarmListing> & { listingUrl: string; state: string; source: string }
): FarmListing {
  const price = partial.price || 0;
  const acreage = partial.acreage || 0;
  return {
    id: partial.id || generateId(partial.source, partial.listingUrl),
    address: partial.address || `Farm in ${partial.state}`,
    city: partial.city || '',
    county: partial.county || '',
    state: partial.state,
    acreage,
    price,
    pricePerAcre: acreage > 0 && price > 0 ? Math.round(price / acreage) : 0,
    dateListed: partial.dateListed || today(),
    priceHistory: price > 0 ? [{ date: today(), price, change: 0 }] : [],
    taxes: partial.taxes || 'Contact listing agent',
    utilities: partial.utilities || 'Contact listing agent',
    description: partial.description || `${acreage} acre farm in ${partial.state}`,
    imageUrl: partial.imageUrl || '',
    listingUrl: partial.listingUrl,
    source: partial.source,
    hasHouse: partial.hasHouse ?? true,
    pasturePercent: partial.pasturePercent ?? 50,
    lastUpdated: new Date().toISOString(),
  };
}

// ─── Scraper helpers ──────────────────────────────────────────────

function extractFromHtml(
  html: string,
  baseUrl: string,
  source: string,
  state: string
): FarmListing[] {
  const $ = cheerio.load(html);
  const listings: FarmListing[] = [];

  // Strategy 1: Property cards (common patterns across sites)
  const cardSelectors = [
    '[data-testid="placards"] > div',
    '[data-testid="property-card"]',
    '.property-card',
    '.listing-card',
    'article.result',
    '.PropertyCard',
    '.search-result',
    '.listing-item',
    '.property-listing',
    '.result-item',
    '.lc-listing',
  ];

  const cards = $(cardSelectors.join(', '));

  cards.each((_, el) => {
    try {
      const card = $(el);
      const linkEl = card.find('a[href]').first();
      const href = linkEl.attr('href') || '';
      const listingUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
      if (!href) return;

      const allText = card.text();
      const price = parsePrice(
        card.find('[class*="price"], .price, [data-testid="price"]').first().text() || allText
      );
      const acreage = parseAcreage(
        card.find('[class*="acre"], .acres, [data-testid="acreage"]').first().text() || allText
      );

      if (acreage < 200) return;

      const locationText =
        card
          .find('[class*="location"], .location, [class*="address"], [data-testid="location"]')
          .first()
          .text() || '';
      const imgEl = card.find('img').first();
      const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';
      const descText = card.find('[class*="desc"], .description, p').first().text().trim();
      const parts = locationText.split(',').map((s: string) => s.trim());

      listings.push(
        makeListing({
          listingUrl,
          state,
          source,
          address: locationText || linkEl.text().trim() || `Farm in ${state}`,
          city: parts[0] || '',
          county: parts.length > 2 ? parts[1] : '',
          acreage,
          price,
          imageUrl,
          description: descText || undefined,
        })
      );
    } catch {
      /* skip */
    }
  });

  // Strategy 2: JSON-LD
  if (listings.length === 0) {
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const raw = $(el).html();
        if (!raw) return;
        const data = JSON.parse(raw);
        const items = Array.isArray(data) ? data : [data];
        for (const item of items) {
          if (
            item['@type'] === 'Product' ||
            item['@type'] === 'RealEstateListing' ||
            item['@type'] === 'SingleFamilyResidence'
          ) {
            const offers = item.offers || {};
            const price = parseFloat(String(offers.price || item.price || 0));
            const text = `${item.name || ''} ${item.description || ''}`;
            const acreage = parseAcreage(text);
            if (acreage < 200) continue;
            const url = item.url || '';
            listings.push(
              makeListing({
                listingUrl: url.startsWith('http') ? url : `${baseUrl}${url}`,
                state,
                source,
                address: item.name || '',
                description: item.description || '',
                imageUrl: item.image || '',
                acreage,
                price,
              })
            );
          }
        }
      } catch {
        /* skip */
      }
    });
  }

  // Strategy 3: __NEXT_DATA__
  if (listings.length === 0) {
    const nd = $('script#__NEXT_DATA__').html();
    if (nd) {
      try {
        const nextData = JSON.parse(nd);
        const pp = nextData?.props?.pageProps || {};
        const arr =
          pp.listings || pp.searchResults || pp.properties || pp.results || pp.data?.listings;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const acreage =
              item.acres || item.acreage || item.lotSize || parseAcreage(String(item.title || ''));
            if (acreage < 200) continue;
            const price = item.price || item.listPrice || 0;
            const addr = item.address || {};
            const url = item.url || item.detailUrl || item.listingUrl || '';
            const imgs = item.images || [];
            listings.push(
              makeListing({
                listingUrl: url.startsWith('http') ? url : `${baseUrl}${url}`,
                state,
                source,
                address: item.title || item.name || `Farm in ${state}`,
                city: addr.city || item.city || '',
                county: addr.county || item.county || '',
                acreage,
                price,
                imageUrl: item.imageUrl || item.primaryImage || item.image || imgs[0] || '',
                description: item.description || '',
                dateListed: item.dateListed || item.listDate || undefined,
                taxes: item.taxes || undefined,
              })
            );
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  // Strategy 4: inline JSON in scripts (some sites embed listing arrays)
  if (listings.length === 0) {
    $('script').each((_, el) => {
      const text = $(el).html() || '';
      // Look for large JSON arrays with property-like objects
      const patterns = [
        /window\.__(?:DATA|STATE|INITIAL_DATA)__\s*=\s*(\{[\s\S]*?\});/,
        /var\s+(?:listings|properties|results)\s*=\s*(\[[\s\S]*?\]);/,
        /"listings"\s*:\s*(\[[\s\S]*?\])\s*[,}]/,
      ];
      for (const pat of patterns) {
        const m = text.match(pat);
        if (m) {
          try {
            const arr = JSON.parse(m[1]);
            const items = Array.isArray(arr) ? arr : arr.listings || arr.results || [];
            if (!Array.isArray(items)) continue;
            for (const item of items) {
              const acreage = item.acres || item.acreage || parseAcreage(String(item.title || ''));
              if (acreage < 200) continue;
              const url = item.url || item.detailUrl || '';
              listings.push(
                makeListing({
                  listingUrl: url.startsWith('http') ? url : `${baseUrl}${url}`,
                  state,
                  source,
                  address: item.title || item.name || `Farm in ${state}`,
                  city: item.city || '',
                  county: item.county || '',
                  acreage,
                  price: item.price || item.listPrice || 0,
                  imageUrl: item.imageUrl || item.image || '',
                  description: item.description || '',
                })
              );
            }
          } catch {
            /* skip */
          }
        }
      }
    });
  }

  return listings;
}

function proxyUrl(url: string): string {
  const apiKey = process.env.SCRAPER_API_KEY;
  if (!apiKey) return url;
  return `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(url)}`;
}

async function fetchAndParse(
  url: string,
  source: string,
  state: string,
  baseUrl: string
): Promise<FarmListing[]> {
  try {
    const fetchUrl = proxyUrl(url);
    const res = await fetch(fetchUrl, {
      headers: process.env.SCRAPER_API_KEY ? {} : HEADERS,
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.log(`[${source}] ${state}: HTTP ${res.status}`);
      return [];
    }
    const html = await res.text();
    const listings = extractFromHtml(html, baseUrl, source, state);
    console.log(`[${source}] ${state}: found ${listings.length} listings`);
    return listings;
  } catch (err) {
    console.error(`[${source}] ${state} error:`, err);
    return [];
  }
}

// ─── Source-specific scrapers ─────────────────────────────────────

export async function scrapeLandWatch(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  const url = `https://www.landwatch.com/${slug}-land-for-sale/farms-ranches`;
  return fetchAndParse(url, 'LandWatch', state, 'https://www.landwatch.com');
}

export async function scrapeLandAndFarm(state: string): Promise<FarmListing[]> {
  const slug = state.replace(/\s+/g, '-');
  const url = `https://www.landandfarm.com/search/${slug}/farms-for-sale/?MinAcreage=200`;
  return fetchAndParse(url, 'Land & Farm', state, 'https://www.landandfarm.com');
}

export async function scrapeUnitedCountry(state: string): Promise<FarmListing[]> {
  const abbr = STATE_ABBREVIATIONS[state]?.toLowerCase() || state.toLowerCase().slice(0, 2);
  const url = `https://farms.unitedcountry.com/for-sale/us/${abbr}`;
  return fetchAndParse(url, 'United Country', state, 'https://farms.unitedcountry.com');
}

export async function scrapeLandCom(state: string): Promise<FarmListing[]> {
  const slug = state.replace(/\s+/g, '-');
  const url = `https://www.land.com/${slug}/farms/200-plus-acres/`;
  return fetchAndParse(url, 'Land.com', state, 'https://www.land.com');
}

// ─── Orchestrator ─────────────────────────────────────────────────

export async function scrapeAllStates(): Promise<FarmListing[]> {
  const states = Object.keys(STATE_ABBREVIATIONS);
  const allListings: FarmListing[] = [];

  // Build all scrape tasks across all states
  const tasks: Promise<FarmListing[]>[] = [];
  for (const state of states) {
    console.log(`Queuing ${state}...`);
    tasks.push(scrapeLandWatch(state));
    tasks.push(scrapeLandAndFarm(state));
    tasks.push(scrapeUnitedCountry(state));
    tasks.push(scrapeLandCom(state));
  }

  // Run all in parallel (ScraperAPI handles concurrency)
  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allListings.push(...result.value);
    }
  }

  // Deduplicate by similar address + acreage
  const seen = new Map<string, FarmListing>();
  for (const listing of allListings) {
    const key = `${listing.state}-${listing.acreage}-${listing.price}`;
    if (!seen.has(key)) {
      seen.set(key, listing);
    }
  }

  return Array.from(seen.values());
}
