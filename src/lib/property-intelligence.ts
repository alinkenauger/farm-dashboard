/**
 * Property intelligence: lazy-loaded USDA soil and FEMA flood data.
 * Fetched on pin click, cached in memory for the session.
 */

export interface PropertyIntelligence {
  soil?: {
    name: string;
    drainageClass: string;
    capabilityClass: string;
    farmlandClass: string;
    status: 'loaded' | 'unavailable' | 'loading';
  };
  flood?: {
    zone: string;
    zoneSubtype: string;
    status: 'loaded' | 'unavailable' | 'loading';
  };
}

// Client-side cache
const cache = new Map<string, PropertyIntelligence>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getCached(lat: number, lng: number): PropertyIntelligence | undefined {
  return cache.get(cacheKey(lat, lng));
}

/**
 * Query USDA Soil Data Access for soil information at a point.
 * SDA uses SQL-like queries via POST.
 */
async function fetchSoilData(lat: number, lng: number): Promise<PropertyIntelligence['soil']> {
  try {
    const query = `SELECT TOP 1 muname, drclassdcd, irrcapcl, farmlndcl
      FROM mapunit
      INNER JOIN component ON mapunit.mukey = component.mukey
      WHERE mukey IN (
        SELECT * FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('POINT(${lng} ${lat})')
      )
      AND component.cokey = (
        SELECT TOP 1 cokey FROM component c2
        WHERE c2.mukey = mapunit.mukey
        ORDER BY c2.comppct_r DESC
      )`;

    const res = await fetch('https://sdmdataaccess.nrcs.usda.gov/Tabular/post.rest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `query=${encodeURIComponent(query)}&format=JSON`,
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return { name: '', drainageClass: '', capabilityClass: '', farmlandClass: '', status: 'unavailable' };

    const data = await res.json();
    const table = data?.Table;
    if (!table || table.length === 0) {
      return { name: '', drainageClass: '', capabilityClass: '', farmlandClass: '', status: 'unavailable' };
    }

    const row = table[0];
    return {
      name: row[0] || 'Unknown',
      drainageClass: row[1] || 'Unknown',
      capabilityClass: row[2] || 'Unknown',
      farmlandClass: row[3] || '',
      status: 'loaded',
    };
  } catch {
    return { name: '', drainageClass: '', capabilityClass: '', farmlandClass: '', status: 'unavailable' };
  }
}

/**
 * Query FEMA National Flood Hazard Layer for flood zone at a point.
 */
async function fetchFloodData(lat: number, lng: number): Promise<PropertyIntelligence['flood']> {
  try {
    const url = `https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
      `&outFields=FLD_ZONE,ZONE_SUBTY&f=json`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { zone: '', zoneSubtype: '', status: 'unavailable' };

    const data = await res.json();
    const features = data?.features;
    if (!features || features.length === 0) {
      return { zone: 'Zone X', zoneSubtype: 'Minimal risk', status: 'loaded' };
    }

    const attrs = features[0].attributes;
    return {
      zone: attrs.FLD_ZONE || 'Unknown',
      zoneSubtype: attrs.ZONE_SUBTY || '',
      status: 'loaded',
    };
  } catch {
    return { zone: '', zoneSubtype: '', status: 'unavailable' };
  }
}

/**
 * Fetch all property intelligence for a location. Returns cached data if available.
 */
export async function fetchPropertyIntelligence(lat: number, lng: number): Promise<PropertyIntelligence> {
  const key = cacheKey(lat, lng);
  const existing = cache.get(key);
  if (existing && existing.soil?.status !== 'loading') return existing;

  // Set loading state
  const loading: PropertyIntelligence = {
    soil: { name: '', drainageClass: '', capabilityClass: '', farmlandClass: '', status: 'loading' },
    flood: { zone: '', zoneSubtype: '', status: 'loading' },
  };
  cache.set(key, loading);

  // Fetch in parallel
  const [soil, flood] = await Promise.all([
    fetchSoilData(lat, lng),
    fetchFloodData(lat, lng),
  ]);

  const result: PropertyIntelligence = { soil, flood };
  cache.set(key, result);
  return result;
}

/**
 * Human-readable flood risk level.
 */
export function floodRiskLevel(zone: string): { label: string; color: string } {
  const z = zone.toUpperCase();
  if (z === 'X' || z === 'AREA OF MINIMAL FLOOD HAZARD') return { label: 'Minimal risk', color: '#16a34a' };
  if (z.startsWith('A') || z.startsWith('V')) return { label: 'High risk', color: '#dc2626' };
  if (z === 'B' || z === 'SHADED X') return { label: 'Moderate risk', color: '#ca8a04' };
  return { label: zone, color: '#6b7280' };
}

/**
 * Human-readable soil capability rating.
 */
export function soilRating(capClass: string): { label: string; color: string } {
  const c = capClass.replace(/[^IViv0-9]/g, '').toUpperCase();
  if (c === 'I' || c === 'II' || c === '1' || c === '2') return { label: 'Prime farmland', color: '#16a34a' };
  if (c === 'III' || c === '3') return { label: 'Good farmland', color: '#65a30d' };
  if (c === 'IV' || c === '4') return { label: 'Fair farmland', color: '#ca8a04' };
  return { label: capClass || 'Unknown', color: '#6b7280' };
}
