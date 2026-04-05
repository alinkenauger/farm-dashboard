'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { FarmListing } from '@/lib/types';

// State center coordinates for listings without lat/lng
const STATE_CENTERS: Record<string, [number, number]> = {
  Kentucky: [37.8, -85.7],
  Missouri: [38.5, -92.3],
  Arkansas: [34.7, -92.3],
  Illinois: [40.0, -89.4],
  Tennessee: [35.5, -86.6],
  Mississippi: [32.7, -89.5],
  Alabama: [32.8, -86.8],
  Georgia: [32.7, -83.5],
  'South Carolina': [33.9, -81.0],
  Florida: [28.7, -82.5],
  Virginia: [37.5, -79.0],
  'West Virginia': [38.6, -80.6],
};

function formatPrice(price: number): string {
  if (price >= 1_000_000) return `$${(price / 1_000_000).toFixed(1)}M`;
  if (price >= 1_000) return `$${(price / 1_000).toFixed(0)}K`;
  return `$${price.toLocaleString()}`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export default function MapView({ listings }: { listings: FarmListing[] }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current).setView([35.5, -86.5], 5);
    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // Add markers with slight random offset for listings without exact coords
    const markers: L.Marker[] = [];
    for (const listing of listings) {
      let lat = listing.lat;
      let lng = listing.lng;

      if (!lat || !lng) {
        const center = STATE_CENTERS[listing.state];
        if (!center) continue;
        // Add random offset so pins don't all stack on same point
        lat = center[0] + (Math.random() - 0.5) * 2;
        lng = center[1] + (Math.random() - 0.5) * 2;
      }

      const priceText = listing.price > 0 ? formatPrice(listing.price) : 'Price N/A';
      const icon = L.divIcon({
        html: `<div style="background:#15803d;color:white;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;white-space:nowrap;border:2px solid white;box-shadow:0 1px 3px rgba(0,0,0,0.3)">${priceText}</div>`,
        className: '',
        iconSize: [0, 0],
        iconAnchor: [30, 15],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(map);
      const safeAddress = escapeHtml(listing.address);
      const safeCity = escapeHtml(listing.city || '');
      const safeState = escapeHtml(listing.state);
      const safeImageUrl = escapeHtml(listing.imageUrl || '');
      const safeListingUrl = escapeHtml(listing.listingUrl);

      marker.bindPopup(`
        <div style="max-width:220px">
          ${safeImageUrl ? `<img src="${safeImageUrl}" style="width:100%;height:100px;object-fit:cover;border-radius:4px;margin-bottom:6px" />` : ''}
          <div style="font-weight:600;font-size:13px;margin-bottom:4px">${safeAddress}</div>
          <div style="font-size:11px;color:#666;margin-bottom:4px">${safeCity ? safeCity + ', ' : ''}${safeState}</div>
          <div style="display:flex;gap:8px;font-size:11px;margin-bottom:6px">
            <span><b>${listing.acreage}</b> acres</span>
            <span><b>${priceText}</b></span>
            ${listing.pricePerAcre > 0 ? `<span><b>$${listing.pricePerAcre.toLocaleString()}</b>/ac</span>` : ''}
          </div>
          <a href="${safeListingUrl}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#15803d;color:white;padding:4px 8px;border-radius:4px;text-decoration:none;font-size:11px;font-weight:500">View Listing</a>
        </div>
      `);
      markers.push(marker);
    }

    // Fit bounds to markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [listings]);

  return (
    <div
      ref={mapRef}
      className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
      style={{ height: '600px' }}
    />
  );
}
