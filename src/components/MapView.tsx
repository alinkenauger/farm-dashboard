'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

interface MapViewProps {
  listings: FarmListing[];
  onSelectListing?: (listing: FarmListing | null) => void;
}

export default function MapView({ listings, onSelectListing }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const [tileMode, setTileMode] = useState<'street' | 'satellite'>('street');

  const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const handlePinClick = useCallback((listing: FarmListing) => {
    onSelectListing?.(listing);
  }, [onSelectListing]);

  useEffect(() => {
    if (!mapRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const map = L.map(mapRef.current, {
      zoomControl: true,
    }).setView([35.5, -86.5], 5);
    mapInstanceRef.current = map;

    // Street tiles (default, always available)
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    });

    // Satellite tiles (Mapbox if token available, ESRI free otherwise)
    const satelliteLayer = MAPBOX_TOKEN
      ? L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}`,
          {
            attribution: '&copy; Mapbox &copy; OpenStreetMap',
            tileSize: 512,
            zoomOffset: -1,
          }
        )
      : L.tileLayer(
          'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          {
            attribution: '&copy; Esri, Maxar, Earthstar Geographics',
          }
        );

    // Add the current tile mode
    if (tileMode === 'satellite') {
      satelliteLayer.addTo(map);
    } else {
      streetLayer.addTo(map);
    }

    // Layer control
    L.control.layers(
      { 'Street': streetLayer, 'Satellite': satelliteLayer },
      {},
      { position: 'topright' }
    ).addTo(map);

    // Add markers
    const markers: L.Marker[] = [];
    for (const listing of listings) {
      let lat = listing.lat;
      let lng = listing.lng;
      let isApproximate = false;

      if (!lat || !lng) {
        const center = STATE_CENTERS[listing.state];
        if (!center) continue;
        lat = center[0] + (Math.random() - 0.5) * 2;
        lng = center[1] + (Math.random() - 0.5) * 2;
        isApproximate = true;
      }

      const priceText = listing.price > 0 ? formatPrice(listing.price) : 'N/A';

      // 44px circular pin with price
      const icon = L.divIcon({
        html: `<div style="
          background:#15803d;
          color:white;
          width:44px;
          height:44px;
          border-radius:50%;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:10px;
          font-weight:700;
          border:2px solid white;
          box-shadow:0 2px 6px rgba(0,0,0,0.3);
          cursor:pointer;
          ${isApproximate ? 'opacity:0.7;' : ''}
        ">${priceText}</div>`,
        className: '',
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const marker = L.marker([lat, lng], { icon });

      // Popup with listing info
      const safeAddress = escapeHtml(listing.address);
      const safeCity = escapeHtml(listing.city || '');
      const safeState = escapeHtml(listing.state);
      const safeImageUrl = escapeHtml(listing.imageUrl || '');
      const safeListingUrl = escapeHtml(listing.listingUrl);

      marker.bindPopup(`
        <div style="max-width:250px">
          ${safeImageUrl ? `<img src="${safeImageUrl}" style="width:100%;height:120px;object-fit:cover;border-radius:6px;margin-bottom:8px" />` : ''}
          <div style="font-weight:700;font-size:14px;margin-bottom:2px;color:#111">${safeAddress}</div>
          <div style="font-size:11px;color:#666;margin-bottom:8px">${safeCity ? safeCity + ', ' : ''}${safeState}${isApproximate ? ' (approximate)' : ''}</div>
          <div style="display:flex;gap:12px;font-size:12px;margin-bottom:8px">
            <div><div style="font-weight:700;color:#15803d">${listing.acreage.toLocaleString()}</div><div style="color:#888;font-size:10px">acres</div></div>
            <div><div style="font-weight:700;color:#15803d">${listing.price > 0 ? formatPrice(listing.price) : 'N/A'}</div><div style="color:#888;font-size:10px">price</div></div>
            ${listing.pricePerAcre > 0 ? `<div><div style="font-weight:700;color:#15803d">$${listing.pricePerAcre.toLocaleString()}</div><div style="color:#888;font-size:10px">per acre</div></div>` : ''}
          </div>
          ${listing.beds || listing.baths ? `<div style="font-size:11px;color:#555;margin-bottom:8px">${listing.beds}bd / ${listing.baths}ba</div>` : ''}
          <div style="display:flex;gap:6px">
            <a href="${safeListingUrl}" target="_blank" rel="noopener noreferrer" style="flex:1;text-align:center;background:#15803d;color:white;padding:6px 10px;border-radius:6px;text-decoration:none;font-size:12px;font-weight:600">View Listing</a>
          </div>
          <div style="font-size:10px;color:#aaa;margin-top:6px;text-align:right">${escapeHtml(listing.source)}</div>
        </div>
      `);

      marker.on('click', () => handlePinClick(listing));
      marker.addTo(map);
      markers.push(marker);
    }

    // Fit bounds
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
  }, [listings, tileMode, MAPBOX_TOKEN, handlePinClick]);

  return (
    <div className="relative">
      <div
        ref={mapRef}
        className="w-full rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={{ height: '700px' }}
      />
      {/* Tile mode toggle */}
      <div className="absolute top-3 left-3 z-[1000] flex bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
        <button
          onClick={() => setTileMode('street')}
          className={`px-3 py-1.5 text-xs font-medium ${tileMode === 'street' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Street
        </button>
        <button
          onClick={() => setTileMode('satellite')}
          className={`px-3 py-1.5 text-xs font-medium ${tileMode === 'satellite' ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
        >
          Satellite
        </button>
      </div>
      {/* Listing count badge */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-white/90 backdrop-blur-sm rounded-lg px-3 py-1.5 shadow-md border border-gray-200 text-xs font-medium text-gray-700">
        {listings.length} farms
      </div>
    </div>
  );
}
