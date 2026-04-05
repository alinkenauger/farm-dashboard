import { notFound } from 'next/navigation';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { FarmListing } from '@/lib/types';
import ListingDetail from '@/components/ListingDetail';

export const dynamic = 'force-dynamic';

async function getListing(id: string): Promise<FarmListing | null> {
  const dataPath = join(process.cwd(), 'data', 'listings.json');
  if (!existsSync(dataPath)) return null;

  try {
    const raw = readFileSync(dataPath, 'utf-8');
    const data = JSON.parse(raw);
    return data.listings.find((l: FarmListing) => l.id === id) || null;
  } catch {
    return null;
  }
}

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListing(decodeURIComponent(id));

  if (!listing) {
    notFound();
  }

  return <ListingDetail listing={listing} />;
}
