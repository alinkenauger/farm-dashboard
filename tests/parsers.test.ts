import { describe, it, expect } from 'vitest';
import { parsePrice, parseAcreage, parseBeds, parseBaths } from '../src/lib/parsers';

describe('parsePrice', () => {
  it('parses simple dollar amount', () => {
    expect(parsePrice('$450,000')).toBe(450000);
  });

  it('parses dollar amount with M', () => {
    expect(parsePrice('$1,250,000')).toBe(1250000);
  });

  it('returns last dollar amount (current price, not "was" price)', () => {
    expect(parsePrice('Was $500,000 Now $450,000')).toBe(450000);
  });

  it('handles "Reduced from $600,000 to $550,000"', () => {
    expect(parsePrice('Reduced from $600,000 to $550,000')).toBe(550000);
  });

  it('parses bare number as fallback', () => {
    expect(parsePrice('450000')).toBe(450000);
  });

  it('returns 0 for no price', () => {
    expect(parsePrice('Price Not Listed')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parsePrice('')).toBe(0);
  });

  it('handles price in mixed text', () => {
    expect(parsePrice('Beautiful 350 acre farm - $1,250,000')).toBe(1250000);
  });

  it('handles decimal prices', () => {
    expect(parsePrice('$450,000.50')).toBe(450000.50);
  });
});

describe('parseAcreage', () => {
  it('parses simple acreage', () => {
    expect(parseAcreage('350 acres')).toBe(350);
  });

  it('parses "ac" abbreviation', () => {
    expect(parseAcreage('350 ac')).toBe(350);
  });

  it('returns largest match (avoids broker info)', () => {
    expect(parseAcreage('6 ac office - 350 acres for sale')).toBe(350);
  });

  it('handles comma-separated thousands', () => {
    expect(parseAcreage('1,200 acres')).toBe(1200);
  });

  it('handles decimal acreage', () => {
    expect(parseAcreage('350.5 acres')).toBe(350.5);
  });

  it('returns 0 for no acreage', () => {
    expect(parseAcreage('Beautiful farm for sale')).toBe(0);
  });

  it('returns 0 for empty string', () => {
    expect(parseAcreage('')).toBe(0);
  });

  it('case insensitive', () => {
    expect(parseAcreage('350 ACRES')).toBe(350);
    expect(parseAcreage('350 Acre')).toBe(350);
  });
});

describe('parseBeds', () => {
  it('parses "3 beds"', () => {
    expect(parseBeds('3 beds')).toBe(3);
  });

  it('parses "4 br"', () => {
    expect(parseBeds('4 br')).toBe(4);
  });

  it('parses "3 bedrooms"', () => {
    expect(parseBeds('3 bedrooms')).toBe(3);
  });

  it('returns 0 for no beds', () => {
    expect(parseBeds('land only')).toBe(0);
  });
});

describe('parseBaths', () => {
  it('parses "2 baths"', () => {
    expect(parseBaths('2 baths')).toBe(2);
  });

  it('parses "2.5 ba"', () => {
    expect(parseBaths('2.5 ba')).toBe(2.5);
  });

  it('returns 0 for no baths', () => {
    expect(parseBaths('land only')).toBe(0);
  });
});
