import * as cheerio from 'cheerio';
import { FarmListing, STATE_ABBREVIATIONS } from './types';

const LANDWATCH_BASE = 'https://www.landwatch.com';

function generateId(url: string): string {
  return Buffer.from(url).toString('base64').slice(0, 20);
}

function parsePrice(text: string): number {
  const match = text.replace(/,/g, '').match(/\$?([\d.]+)/);
  return match ? parseFloat(match[1]) : 0;
}

function parseAcreage(text: string): number {
  const match = text.replace(/,/g, '').match(/([\d.]+)\s*(?:acres?|ac)/i);
  return match ? parseFloat(match[1]) : 0;
}

export async function scrapeLandWatch(state: string): Promise<FarmListing[]> {
  const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
  const abbr = STATE_ABBREVIATIONS[state] || state;

  // Search for farms/ranches with houses, 200+ acres
  const url = `${LANDWATCH_BASE}/${stateSlug}-farms-ranches-for-sale/200-plus-acres`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch ${url}: ${response.status}`);
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);
    const listings: FarmListing[] = [];

    // LandWatch uses different selectors - try multiple patterns
    const cards = $('[data-testid="property-card"], .property-card, .listing-card, article.result');

    cards.each((_, el) => {
      try {
        const card = $(el);
        const linkEl = card.find('a[href*="/"]').first();
        const href = linkEl.attr('href') || '';
        const listingUrl = href.startsWith('http') ? href : `${LANDWATCH_BASE}${href}`;

        const priceText = card.find('[class*="price"], .price, [data-testid="price"]').first().text();
        const price = parsePrice(priceText);

        const acreageText = card.find('[class*="acre"], .acres, [data-testid="acreage"]').first().text() || card.text();
        const acreage = parseAcreage(acreageText);

        if (acreage < 200) return; // Skip under 200 acres

        const locationText =
          card.find('[class*="location"], .location, [class*="address"], [data-testid="location"]').first().text() ||
          '';
        const imgEl = card.find('img').first();
        const imageUrl = imgEl.attr('src') || imgEl.attr('data-src') || '';

        const descText = card.find('[class*="description"], .description, p').first().text().trim();

        // Parse location
        const locationParts = locationText.split(',').map((s: string) => s.trim());
        const city = locationParts[0] || '';
        const stateFromText = locationParts[locationParts.length - 1] || state;

        const listing: FarmListing = {
          id: generateId(listingUrl || `${state}-${Date.now()}-${Math.random()}`),
          address: locationText || `Farm in ${city || state}`,
          city: city,
          county: locationParts.length > 2 ? locationParts[1] : '',
          state: state,
          acreage,
          price,
          pricePerAcre: acreage > 0 && price > 0 ? Math.round(price / acreage) : 0,
          dateListed: new Date().toISOString().split('T')[0],
          priceHistory: price > 0 ? [{ date: new Date().toISOString().split('T')[0], price, change: 0 }] : [],
          taxes: 'Contact listing agent',
          utilities: 'Contact listing agent',
          description: descText || `Farm/ranch property in ${state} - ${acreage} acres`,
          imageUrl: imageUrl,
          listingUrl,
          source: 'LandWatch',
          hasHouse: true, // Filtered for homes
          pasturePercent: 50,
          lastUpdated: new Date().toISOString(),
        };

        if (listing.listingUrl && listing.acreage >= 200) {
          listings.push(listing);
        }
      } catch {
        // Skip malformed entries
      }
    });

    // If card-based parsing didn't work, try JSON-LD or script data
    if (listings.length === 0) {
      const scriptTags = $('script[type="application/ld+json"]');
      scriptTags.each((_, el) => {
        try {
          const jsonText = $(el).html();
          if (!jsonText) return;
          const data = JSON.parse(jsonText);
          if (Array.isArray(data)) {
            data.forEach((item: Record<string, unknown>) => {
              if (item['@type'] === 'Product' || item['@type'] === 'RealEstateListing') {
                const listing = parseJsonLdListing(item, state);
                if (listing && listing.acreage >= 200) {
                  listings.push(listing);
                }
              }
            });
          }
        } catch {
          // JSON parse failed
        }
      });
    }

    // Try to extract from Next.js/React hydration data
    if (listings.length === 0) {
      const scriptContent = $('script#__NEXT_DATA__').html();
      if (scriptContent) {
        try {
          const nextData = JSON.parse(scriptContent);
          const props = nextData?.props?.pageProps;
          if (props?.listings || props?.searchResults || props?.properties) {
            const items = props.listings || props.searchResults || props.properties;
            if (Array.isArray(items)) {
              items.forEach((item: Record<string, unknown>) => {
                const listing = parseApiListing(item, state);
                if (listing && listing.acreage >= 200) {
                  listings.push(listing);
                }
              });
            }
          }
        } catch {
          // Parse failed
        }
      }
    }

    return listings;
  } catch (error) {
    console.error(`Error scraping ${state}:`, error);
    return [];
  }
}

function parseJsonLdListing(
  item: Record<string, unknown>,
  state: string
): FarmListing | null {
  try {
    const name = (item.name as string) || '';
    const description = (item.description as string) || '';
    const url = (item.url as string) || '';
    const offers = item.offers as Record<string, unknown> | undefined;
    const price = offers ? parseFloat(String(offers.price || '0')) : 0;
    const image = (item.image as string) || '';

    const acreageMatch = `${name} ${description}`.match(/([\d,.]+)\s*(?:acres?|ac)/i);
    const acreage = acreageMatch ? parseFloat(acreageMatch[1].replace(/,/g, '')) : 0;

    return {
      id: generateId(url || name),
      address: name,
      city: '',
      county: '',
      state,
      acreage,
      price,
      pricePerAcre: acreage > 0 && price > 0 ? Math.round(price / acreage) : 0,
      dateListed: new Date().toISOString().split('T')[0],
      priceHistory: price > 0 ? [{ date: new Date().toISOString().split('T')[0], price, change: 0 }] : [],
      taxes: 'Contact listing agent',
      utilities: 'Contact listing agent',
      description,
      imageUrl: image,
      listingUrl: url.startsWith('http') ? url : `${LANDWATCH_BASE}${url}`,
      source: 'LandWatch',
      hasHouse: true,
      pasturePercent: 50,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function parseApiListing(
  item: Record<string, unknown>,
  state: string
): FarmListing | null {
  try {
    const acreage =
      (item.acres as number) ||
      (item.acreage as number) ||
      (item.lotSize as number) ||
      parseAcreage(String(item.title || item.name || ''));
    const price = (item.price as number) || (item.listPrice as number) || 0;

    const address = item.address as Record<string, string> | undefined;
    const city = address?.city || (item.city as string) || '';
    const county = address?.county || (item.county as string) || '';

    const images = item.images as string[] | undefined;
    const imageUrl =
      (item.imageUrl as string) ||
      (item.primaryImage as string) ||
      (item.image as string) ||
      (images && images[0]) ||
      '';

    const url = (item.url as string) || (item.detailUrl as string) || (item.listingUrl as string) || '';

    return {
      id: generateId(url || String(item.id || Math.random())),
      address: (item.title as string) || (item.name as string) || `Farm in ${city}, ${state}`,
      city,
      county,
      state,
      acreage,
      price,
      pricePerAcre: acreage > 0 && price > 0 ? Math.round(price / acreage) : 0,
      dateListed: (item.dateListed as string) || (item.listDate as string) || new Date().toISOString().split('T')[0],
      priceHistory: price > 0 ? [{ date: new Date().toISOString().split('T')[0], price, change: 0 }] : [],
      taxes: (item.taxes as string) || 'Contact listing agent',
      utilities: (item.utilities as string) || 'Contact listing agent',
      description:
        (item.description as string) || `${acreage} acre farm/ranch in ${city || state}`,
      imageUrl,
      listingUrl: url.startsWith('http') ? url : `${LANDWATCH_BASE}${url}`,
      source: 'LandWatch',
      hasHouse: true,
      pasturePercent: 50,
      lastUpdated: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function scrapeAllStates(): Promise<FarmListing[]> {
  const states = Object.keys(STATE_ABBREVIATIONS);
  const allListings: FarmListing[] = [];

  // Scrape states sequentially to be polite to servers
  for (const state of states) {
    console.log(`Scraping ${state}...`);
    const listings = await scrapeLandWatch(state);
    allListings.push(...listings);
    // Small delay between states
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return allListings;
}
