/**
 * Parsing utilities for farm listing data.
 * Extracted for testability.
 */

export function parsePrice(text: string): number {
  // Find ALL dollar amounts and return the LAST one (current price, not original/was price)
  const cleaned = text.replace(/,/g, '');
  const matches = [...cleaned.matchAll(/\$([\d.]+)/g)];
  if (matches.length > 0) return parseFloat(matches[matches.length - 1][1]);
  // Fallback: bare number (for structured data)
  const bareMatch = cleaned.match(/([\d.]+)/);
  return bareMatch ? parseFloat(bareMatch[1]) : 0;
}

export function parseAcreage(text: string): number {
  // Find ALL acre matches and return the largest one.
  const matches = text.replace(/,/g, '').matchAll(/([\d.]+)\s*(?:acres?|ac\b)/gi);
  let max = 0;
  for (const m of matches) {
    const val = parseFloat(m[1]);
    if (val > max) max = val;
  }
  return max;
}

export function parseBeds(text: string): number {
  const match = text.match(/(\d+)\s*(?:beds?|br|bedrooms?)/i);
  return match ? parseInt(match[1]) : 0;
}

export function parseBaths(text: string): number {
  const match = text.match(/([\d.]+)\s*(?:baths?|ba|bathrooms?)/i);
  return match ? parseFloat(match[1]) : 0;
}
