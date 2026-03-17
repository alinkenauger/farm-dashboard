import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Farm Finder - 200+ Acre Farms for Sale',
  description:
    'Find farms over 200 acres for sale in KY, MO, AR, IL, TN, MS, AL, GA, SC, FL with 50%+ pasture and a house.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
