export interface FarmListing {
  id: string;
  address: string;
  city: string;
  county: string;
  state: string;
  acreage: number;
  price: number;
  pricePerAcre: number;
  dateListed: string;
  priceHistory: PriceChange[];
  taxes: string;
  utilities: string;
  description: string;
  imageUrl: string;
  images: string[];
  listingUrl: string;
  source: string;
  hasHouse: boolean;
  pasturePercent: number;
  lastUpdated: string;
  beds: number;
  baths: number;
  lat?: number;
  lng?: number;
}

export interface PriceChange {
  date: string;
  price: number;
  change: number;
}

export interface FilterState {
  search: string;
  states: string[];
  minAcres: number;
  maxAcres: number;
  minPrice: number;
  maxPrice: number;
  sortBy: 'price_asc' | 'price_desc' | 'acres_asc' | 'acres_desc' | 'date_newest' | 'date_oldest' | 'ppa_asc' | 'ppa_desc';
}

export const TARGET_STATES = [
  'Kentucky',
  'Missouri',
  'Arkansas',
  'Illinois',
  'Tennessee',
  'Mississippi',
  'Alabama',
  'South Carolina',
  'Virginia',
] as const;

export const STATE_ABBREVIATIONS: Record<string, string> = {
  Kentucky: 'KY',
  Missouri: 'MO',
  Arkansas: 'AR',
  Illinois: 'IL',
  Tennessee: 'TN',
  Mississippi: 'MS',
  Alabama: 'AL',
  'South Carolina': 'SC',
  Virginia: 'VA',
};
