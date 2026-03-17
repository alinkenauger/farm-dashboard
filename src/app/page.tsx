import Dashboard from '@/components/Dashboard';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Farm Finder - 200+ Acre Farms for Sale',
  description:
    'Find farms over 200 acres for sale in KY, MO, AR, IL, TN, MS, AL, GA, SC, FL. 50%+ pasture with a house on the property.',
};

export default function Home() {
  return <Dashboard />;
}
