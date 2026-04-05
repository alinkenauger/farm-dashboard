import * as cheerio from 'cheerio';
import { FarmListing, STATE_ABBREVIATIONS } from './types';
import { parsePrice, parseAcreage, parseBeds, parseBaths } from './parsers';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.5',
};

function generateId(source: string, key: string): string {
  return `${source}-${Buffer.from(key).toString('base64').slice(0, 16)}`;
}

function today(): string {
  return new Date().toISOString().split('T')[0];
}

function resolveUrl(src: string, base: string): string {
  if (!src || src.startsWith('data:')) return '';
  if (src.startsWith('//')) return `https:${src}`;
  if (src.startsWith('http')) return src;
  if (src.startsWith('/')) {
    try {
      const u = new URL(base);
      return `${u.origin}${src}`;
    } catch { return src; }
  }
  return `${base.replace(/\/$/, '')}/${src}`;
}

function isValidImage(src: string): boolean {
  if (!src || src.startsWith('data:')) return false;
  const lower = src.toLowerCase();
  // Filter out logos, icons, tracking pixels, spacers
  const blacklist = ['logo', 'icon', 'sprite', 'pixel', 'tracking', 'spacer', 'blank',
    'placeholder', '1x1', 'badge', 'avatar', 'favicon', 'spinner', 'loader', 'svg+xml'];
  if (blacklist.some(b => lower.includes(b))) return false;
  // Must look like an image URL or contain image extension
  if (/\.(jpg|jpeg|png|webp|avif)/.test(lower)) return true;
  // CDN image URLs without extensions
  if (/images|photos|media|cdn|img|assets|uploads|pictures/.test(lower)) return true;
  return false;
}

function extractImages($: cheerio.CheerioAPI, container: cheerio.Cheerio<any>, baseUrl: string): string[] {
  const images: string[] = [];
  const seen = new Set<string>();

  const addImage = (src: string) => {
    const resolved = resolveUrl(src, baseUrl);
    if (resolved && isValidImage(resolved) && !seen.has(resolved)) {
      seen.add(resolved);
      images.push(resolved);
    }
  };

  container.find('img').each((_, img) => {
    const el = $(img);
    // Try multiple image source attributes
    const src = el.attr('src') || '';
    const dataSrc = el.attr('data-src') || '';
    const dataLazySrc = el.attr('data-lazy-src') || '';
    const dataOriginal = el.attr('data-original') || '';

    // srcset can contain higher-res images
    const srcset = el.attr('srcset') || el.attr('data-srcset') || '';
    if (srcset) {
      const parts = srcset.split(',');
      for (const part of parts) {
        const url = part.trim().split(/\s+/)[0];
        if (url) addImage(url);
      }
    }

    addImage(dataLazySrc);
    addImage(dataOriginal);
    addImage(dataSrc);
    addImage(src);
  });

  // Check for background-image in style attributes
  container.find('[style*="background"]').each((_, el) => {
    const style = $(el).attr('style') || '';
    const bgMatch = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
    if (bgMatch) addImage(bgMatch[1]);
  });

  // Check source elements (inside picture tags)
  container.find('source').each((_, el) => {
    const srcset = $(el).attr('srcset') || '';
    if (srcset) {
      const url = srcset.split(',')[0].trim().split(/\s+/)[0];
      if (url) addImage(url);
    }
  });

  return images;
}

function makeListing(
  partial: Partial<FarmListing> & { listingUrl: string; state: string; source: string }
): FarmListing {
  let price = partial.price || 0;
  const acreage = partial.acreage || 0;

  // Sanity check: if price equals acreage, it's a parsing error (grabbed acreage as price)
  if (price > 0 && acreage > 0 && price === acreage) price = 0;
  // Prices under $10,000 for 200+ acre farms are not real sale prices (likely auctions/leases)
  if (price > 0 && price < 10000 && acreage >= 200) price = 0;
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
    images: partial.images || (partial.imageUrl ? [partial.imageUrl] : []),
    listingUrl: partial.listingUrl,
    source: partial.source,
    hasHouse: partial.hasHouse ?? false,
    pasturePercent: partial.pasturePercent ?? 0,
    lastUpdated: new Date().toISOString(),
    beds: partial.beds || 0,
    baths: partial.baths || 0,
    lat: partial.lat,
    lng: partial.lng,
  };
}

// ---- Site-specific parsers ----

function parseLandWatch(html: string, state: string): FarmListing[] {
  const $ = cheerio.load(html);
  const listings: FarmListing[] = [];
  const baseUrl = 'https://www.landwatch.com';

  // LandWatch uses data-qa-placardinfo for each listing's info section
  $('[data-qa-placardinfo]').each((_, el) => {
    try {
      const infoSection = $(el);
      const card = infoSection.closest('[data-qa-placard]').length
        ? infoSection.closest('[data-qa-placard]')
        : infoSection.parent().parent();

      // LandWatch uses /pid/ URLs
      const linkEl = card.find('a[href*="/pid/"]').first() || card.find('a[href]').first();
      if (!linkEl.length) return;
      const href = linkEl.attr('href') || '';
      if (!href || href === '#') return;
      const listingUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

      // Extract price and acres from the info section only (not broker text)
      const infoText = infoSection.text();
      const price = parsePrice(infoText);
      const acreage = parseAcreage(infoText);

      if (acreage < 200) return;

      const titleText = linkEl.text().trim() || card.find('h2, h3').first().text().trim();
      const beds = parseBeds(infoText);
      const baths = parseBaths(infoText);
      const images = extractImages($, card, baseUrl);

      listings.push(
        makeListing({
          listingUrl,
          state,
          source: 'LandWatch',
          address: titleText || `Farm in ${state}`,
          acreage,
          price,
          imageUrl: images[0] || '',
          images,
          beds,
          baths,
        })
      );
    } catch (err) {
      console.warn(`[parse] Skipped listing:`, err instanceof Error ? err.message : err);
    }
  });

  return listings;
}

function parseRLNSites(html: string, state: string, source: string): FarmListing[] {
  const $ = cheerio.load(html);
  const listings: FarmListing[] = [];
  const baseUrl = source === 'Land & Farm' ? 'https://www.landandfarm.com'
    : source === 'Lands of America' ? 'https://www.landsofamerica.com'
    : 'https://www.land.com';

  // All Realtors Land Network sites use data-qa-placard with data-qa-placardinfo
  const placards = $('[data-qa-placardinfo]');

  placards.each((_, el) => {
    try {
      const infoSection = $(el);
      // The placard container is a parent
      const card = infoSection.closest('[data-qa-placard]').length
        ? infoSection.closest('[data-qa-placard]')
        : infoSection.parent().parent();

      // Link - uses /property/ on Land.com/LandAndFarm/LOA
      const linkEl = card.find('a[href*="/property/"]').first()
        || card.find('a[href*="/pid/"]').first()
        || card.find('a[href]').first();
      const href = linkEl.attr('href') || '';
      if (!href || href === '#') return;
      const listingUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;

      // Extract price and acres from info section ONLY (not broker text)
      const infoText = infoSection.text();
      const price = parsePrice(infoText);
      const acreage = parseAcreage(infoText);
      if (acreage < 200) return;

      const beds = parseBeds(infoText);
      const baths = parseBaths(infoText);
      const images = extractImages($, card, baseUrl);
      const title = linkEl.text().trim() || card.find('h2, h3').first().text().trim();

      listings.push(
        makeListing({
          listingUrl,
          state,
          source,
          address: title || `Farm in ${state}`,
          acreage,
          price,
          imageUrl: images[0] || '',
          images,
          beds,
          baths,
        })
      );
    } catch (err) {
      console.warn(`[parse] Skipped listing:`, err instanceof Error ? err.message : err);
    }
  });

  return listings;
}

// ---- Generic parser (fallback) ----

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
    '[data-qa-placard]',
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
    '.result-card',
    '.lc-listing',
    '.property-item',
    '.property',
  ];

  const cards = $(cardSelectors.join(', '));

  cards.each((_, el) => {
    try {
      const card = $(el);
      const linkEl = card.find('a[href]').first();
      const href = linkEl.attr('href') || '';
      const listingUrl = href.startsWith('http') ? href : `${baseUrl}${href}`;
      if (!href) return;

      // Prefer structured info section for price/acres, fall back to all card text
      const infoSection = card.find('[data-qa-placardinfo], [class*="info"], [class*="detail"]').first();
      const textForParsing = infoSection.length ? infoSection.text() : card.text();

      const price = parsePrice(
        card.find('[class*="price"], .price, [data-testid="price"]').first().text() || textForParsing
      );
      const acreage = parseAcreage(textForParsing);

      if (acreage < 200) return;

      const beds = parseBeds(textForParsing);
      const baths = parseBaths(textForParsing);

      const locationText =
        card
          .find('[class*="location"], .location, [class*="address"], [data-testid="location"]')
          .first()
          .text() || '';

      // Extract all images with improved resolution
      const images = extractImages($, card, baseUrl);
      const imageUrl = images[0] || '';

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
          images,
          description: descText || undefined,
          beds,
          baths,
        })
      );
    } catch (err) {
      console.warn(`[parse] Skipped listing:`, err instanceof Error ? err.message : err);
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
            const jsonImages = Array.isArray(item.image) ? item.image : item.image ? [item.image] : [];
            const resolvedImages = jsonImages.map((i: string) => resolveUrl(i, baseUrl)).filter(isValidImage);
            listings.push(
              makeListing({
                listingUrl: url.startsWith('http') ? url : `${baseUrl}${url}`,
                state,
                source,
                address: item.name || '',
                description: item.description || '',
                imageUrl: resolvedImages[0] || '',
                images: resolvedImages,
                acreage,
                price,
                beds: parseBeds(text),
                baths: parseBaths(text),
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
            const rawImgs = item.images || item.photos || item.media || [];
            const imgs = (Array.isArray(rawImgs) ? rawImgs : [])
              .map((i: any) => typeof i === 'string' ? i : i?.url || i?.href || i?.src || '')
              .map((i: string) => resolveUrl(i, baseUrl))
              .filter(isValidImage);
            const primaryImg = resolveUrl(item.imageUrl || item.primaryImage || item.image || item.thumbnail || '', baseUrl);
            if (primaryImg && isValidImage(primaryImg) && !imgs.includes(primaryImg)) imgs.unshift(primaryImg);
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
                imageUrl: imgs[0] || '',
                images: imgs,
                description: item.description || '',
                dateListed: item.dateListed || item.listDate || undefined,
                taxes: item.taxes || undefined,
                beds: item.beds || item.bedrooms || 0,
                baths: item.baths || item.bathrooms || 0,
                lat: item.lat || item.latitude || addr.lat,
                lng: item.lng || item.longitude || addr.lng,
              })
            );
          }
        }
      } catch {
        /* skip */
      }
    }
  }

  // Strategy 4: inline JSON in scripts
  if (listings.length === 0) {
    $('script').each((_, el) => {
      const text = $(el).html() || '';
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
              const rawImgs4 = item.images || item.photos || item.media || [];
              const imgs4 = (Array.isArray(rawImgs4) ? rawImgs4 : [])
                .map((i: any) => typeof i === 'string' ? i : i?.url || i?.href || i?.src || '')
                .map((i: string) => resolveUrl(i, baseUrl))
                .filter(isValidImage);
              const primaryImg4 = resolveUrl(item.imageUrl || item.image || item.thumbnail || '', baseUrl);
              if (primaryImg4 && isValidImage(primaryImg4) && !imgs4.includes(primaryImg4)) imgs4.unshift(primaryImg4);
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
                  imageUrl: imgs4[0] || '',
                  images: imgs4,
                  description: item.description || '',
                  beds: item.beds || 0,
                  baths: item.baths || 0,
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

// Direct fetch first, ScraperAPI fallback for blocked requests

// Map sources to their site-specific parsers
const SITE_PARSERS: Record<string, (html: string, state: string) => FarmListing[]> = {
  'LandWatch': parseLandWatch,
  'Land & Farm': (html, state) => parseRLNSites(html, state, 'Land & Farm'),
  'Land.com': (html, state) => parseRLNSites(html, state, 'Land.com'),
  'Lands of America': (html, state) => parseRLNSites(html, state, 'Lands of America'),
};

async function fetchHtml(url: string, source: string, state: string): Promise<string | null> {
  // Try direct fetch first (faster, no API costs)
  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const html = await res.text();
      if (html.length > 1000) return html; // Got real content
    }
    // 403/429 = likely blocked, fall through to proxy
    if (res.status === 403 || res.status === 429) {
      console.log(`[${source}] ${state}: direct blocked (${res.status}), trying proxy...`);
    } else if (!res.ok) {
      console.log(`[${source}] ${state}: direct HTTP ${res.status}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[${source}] ${state}: direct failed (${msg}), trying proxy...`);
  }

  // Fallback to ScraperAPI proxy
  const proxyUrlStr = proxyUrl(url);
  if (proxyUrlStr === url) return null; // No API key, can't proxy

  try {
    const res = await fetch(proxyUrlStr, {
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.log(`[${source}] ${state}: proxy HTTP ${res.status}`);
      return null;
    }
    return await res.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${source}] ${state}: proxy failed: ${msg}`);
    return null;
  }
}

async function fetchAndParse(
  url: string,
  source: string,
  state: string,
  baseUrl: string
): Promise<FarmListing[]> {
  try {
    const html = await fetchHtml(url, source, state);
    if (!html) return [];

    // Use site-specific parser if available, fall back to generic
    const siteParser = SITE_PARSERS[source];
    let listings: FarmListing[];
    if (siteParser) {
      listings = siteParser(html, state);
      if (listings.length === 0) {
        listings = extractFromHtml(html, baseUrl, source, state);
      }
    } else {
      listings = extractFromHtml(html, baseUrl, source, state);
    }

    console.log(`[${source}] ${state}: found ${listings.length} listings`);
    return listings;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[${source}] ${state} error: ${msg}`);
    return [];
  }
}

// ---- Source-specific scrapers ----

// Scrape multiple pages from a source to get more listings
async function fetchPages(
  urlFn: (page: number) => string,
  source: string,
  state: string,
  baseUrl: string,
  maxPages = 1
): Promise<FarmListing[]> {
  const all: FarmListing[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const results = await fetchAndParse(urlFn(page), source, state, baseUrl);
    all.push(...results);
    // If a page returned 0 results, no point fetching more pages
    if (results.length === 0) break;
  }
  return all;
}

export async function scrapeLandWatch(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.landwatch.com/${slug}-land-for-sale/farms-ranches${page > 1 ? `/page-${page}` : ''}`,
    'LandWatch', state, 'https://www.landwatch.com'
  );
}

export async function scrapeLandAndFarm(state: string): Promise<FarmListing[]> {
  const slug = state.replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.landandfarm.com/search/${slug}/farms-for-sale/?MinAcreage=200${page > 1 ? `&page=${page}` : ''}`,
    'Land & Farm', state, 'https://www.landandfarm.com'
  );
}

export async function scrapeUnitedCountry(state: string): Promise<FarmListing[]> {
  const abbr = STATE_ABBREVIATIONS[state]?.toLowerCase() || state.toLowerCase().slice(0, 2);
  return fetchPages(
    (page) => `https://farms.unitedcountry.com/for-sale/us/${abbr}${page > 1 ? `?page=${page}` : ''}`,
    'United Country', state, 'https://farms.unitedcountry.com'
  );
}

export async function scrapeLandCom(state: string): Promise<FarmListing[]> {
  const slug = state.replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.land.com/${slug}/farms/200-plus-acres/${page > 1 ? `page-${page}/` : ''}`,
    'Land.com', state, 'https://www.land.com'
  );
}

export async function scrapeFarmFlip(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.farmflip.com/farms-for-sale/${slug}${page > 1 ? `?page=${page}` : ''}`,
    'FarmFlip', state, 'https://www.farmflip.com'
  );
}

export async function scrapeMossyOak(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.mossyoakproperties.com/land-for-sale/${slug}/farms-ranches${page > 1 ? `?page=${page}` : ''}`,
    'Mossy Oak', state, 'https://www.mossyoakproperties.com'
  );
}

export async function scrapeWhitetail(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.whitetailproperties.com/properties/${slug}/farms${page > 1 ? `?page=${page}` : ''}`,
    'Whitetail', state, 'https://www.whitetailproperties.com'
  );
}

export async function scrapeLandSearch(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.landsearch.com/${slug}/farms-ranches/over-200-acres${page > 1 ? `/${page}` : ''}`,
    'LandSearch', state, 'https://www.landsearch.com'
  );
}

export async function scrapeRealtor(state: string): Promise<FarmListing[]> {
  const abbr = STATE_ABBREVIATIONS[state]?.toUpperCase() || state.toUpperCase().slice(0, 2);
  return fetchPages(
    (page) => `https://www.realtor.com/realestateandhomes-search/${abbr}/type-farm/sqft-na/lot-200-ac${page > 1 ? `/pg-${page}` : ''}`,
    'Realtor.com', state, 'https://www.realtor.com'
  );
}

export async function scrapeLandsOfAmerica(state: string): Promise<FarmListing[]> {
  const slug = state.toLowerCase().replace(/\s+/g, '-');
  return fetchPages(
    (page) => `https://www.landsofamerica.com/${slug}/farms-for-sale/200-plus-acres${page > 1 ? `/page-${page}` : ''}`,
    'Lands of America', state, 'https://www.landsofamerica.com'
  );
}

// ---- Orchestrator ----

// Only use the 4 RLN network sites that have working site-specific parsers
// UnitedCountry/FarmFlip use generic parser and return 0 results anyway
const ALL_SCRAPERS = [
  scrapeLandWatch,
  scrapeLandAndFarm,
  scrapeLandCom,
  scrapeLandsOfAmerica,
];

async function scrapeStateQuick(state: string): Promise<FarmListing[]> {
  console.log(`[${state}] Starting scrape from ${ALL_SCRAPERS.length} sources...`);

  // Run all scrapers for this state in parallel
  const results = await Promise.allSettled(ALL_SCRAPERS.map(s => s(state)));
  const listings: FarmListing[] = [];
  let succeeded = 0;
  let failed = 0;

  for (const result of results) {
    if (result.status === 'fulfilled') {
      succeeded++;
      listings.push(...result.value);
    } else {
      failed++;
      console.error(`[${state}] source failed: ${result.reason}`);
    }
  }

  console.log(`[${state}] Done: ${listings.length} listings (${succeeded} ok, ${failed} failed)`);
  return listings;
}

export async function scrapeStates(states: string[]): Promise<FarmListing[]> {
  const allListings: FarmListing[] = [];

  // Scrape states in batches of 3 to avoid overwhelming connections
  console.log(`Scraping ${states.length} states (3 at a time)...`);
  for (let i = 0; i < states.length; i += 3) {
    const batch = states.slice(i, i + 3);
    console.log(`Batch ${Math.floor(i / 3) + 1}: ${batch.join(', ')}`);
    const stateResults = await Promise.allSettled(batch.map(state => scrapeStateQuick(state)));
    for (const result of stateResults) {
      if (result.status === 'fulfilled') {
        allListings.push(...result.value);
      } else {
        console.error(`State scrape failed:`, result.reason);
      }
    }
  }

  // Deduplicate by listing URL (same property on different sites will have different URLs)
  // Also dedup by address+acreage combo to catch cross-site duplicates
  const seen = new Map<string, FarmListing>();
  const addrKey = new Set<string>();
  for (const listing of allListings) {
    // Primary dedup: exact URL
    const urlKey = listing.listingUrl;
    if (seen.has(urlKey)) continue;
    // Secondary dedup: same address + acreage (cross-site duplicate)
    const ak = `${listing.address.toLowerCase().replace(/\s+/g, '')}-${listing.acreage}`;
    if (addrKey.has(ak)) continue;
    addrKey.add(ak);
    seen.set(urlKey, listing);
  }

  console.log(`Total unique listings: ${seen.size} from ${allListings.length} raw`);
  return Array.from(seen.values());
}
