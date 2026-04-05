/**
 * Property intelligence: lazy-loaded environmental and land data.
 * All data fetched from free government APIs on pin click.
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
  water?: {
    violations: number;
    facilities: number;
    facilityNames: string[];
    status: 'loaded' | 'unavailable' | 'loading';
  };
  toxics?: {
    sites: { name: string; distance: string; type: string }[];
    status: 'loaded' | 'unavailable' | 'loading';
  };
  broadband?: {
    maxDown: number;
    maxUp: number;
    providers: string[];
    status: 'loaded' | 'unavailable' | 'loading';
  };
  wetlands?: {
    hasWetlands: boolean;
    types: string[];
    status: 'loaded' | 'unavailable' | 'loading';
  };
}

const cache = new Map<string, PropertyIntelligence>();

function cacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function getCached(lat: number, lng: number): PropertyIntelligence | undefined {
  return cache.get(cacheKey(lat, lng));
}

// ---- USDA Soil ----

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

// ---- FEMA Flood ----

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

// ---- EPA Water Quality (ECHO) ----

async function fetchWaterData(lat: number, lng: number): Promise<PropertyIntelligence['water']> {
  try {
    const url = `https://echodata.epa.gov/echo/echo_rest_services.get_facilities?output=JSON` +
      `&p_lat=${lat}&p_long=${lng}&p_radius=3` +
      `&p_med=CWA&p_qiv=VIOL&responseset=10`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { violations: 0, facilities: 0, facilityNames: [], status: 'unavailable' };

    const data = await res.json();
    const results = data?.Results;
    if (!results) return { violations: 0, facilities: 0, facilityNames: [], status: 'unavailable' };

    const facilities = results.Facilities || [];
    const facilityNames = facilities
      .slice(0, 5)
      .map((f: any) => f.FacName || '')
      .filter(Boolean);

    const totalViolations = facilities.reduce(
      (sum: number, f: any) => sum + (parseInt(f.CWAQtrsInNC) || 0), 0
    );

    return { violations: totalViolations, facilities: facilities.length, facilityNames, status: 'loaded' };
  } catch {
    return { violations: 0, facilities: 0, facilityNames: [], status: 'unavailable' };
  }
}

// ---- EPA Toxic Releases / Superfund (Envirofacts TRI + Superfund) ----

async function fetchToxicData(lat: number, lng: number): Promise<PropertyIntelligence['toxics']> {
  try {
    // EPA Envirofacts TRI facilities within ~5 mile radius
    // Using the SEMS (Superfund) and TRI APIs
    const triUrl = `https://data.epa.gov/efservice/TRI_FACILITY/PREF_LATITUDE/${(lat - 0.07).toFixed(4)}/${(lat + 0.07).toFixed(4)}/PREF_LONGITUDE/${(lng - 0.07).toFixed(4)}/${(lng + 0.07).toFixed(4)}/JSON/rows/0:10`;

    const res = await fetch(triUrl, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { sites: [], status: 'unavailable' };

    const data = await res.json();
    const sites = (Array.isArray(data) ? data : []).slice(0, 5).map((f: any) => ({
      name: f.FACILITY_NAME || f.FAC_NAME || 'Unknown',
      distance: `${((Math.abs(f.PREF_LATITUDE - lat) + Math.abs(f.PREF_LONGITUDE - lng)) * 69).toFixed(1)} mi`,
      type: 'Toxic Release Inventory',
    }));

    return { sites, status: 'loaded' };
  } catch {
    return { sites: [], status: 'unavailable' };
  }
}

// ---- FCC Broadband ----

async function fetchBroadbandData(lat: number, lng: number): Promise<PropertyIntelligence['broadband']> {
  try {
    // FCC Broadband Map API
    const url = `https://broadbandmap.fcc.gov/api/public/map/listAvailableFixedProvidersByLocation?latitude=${lat}&longitude=${lng}&speed_category=25_3`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { maxDown: 0, maxUp: 0, providers: [], status: 'unavailable' };

    const data = await res.json();
    const providers = (data?.data || []).map((p: any) => p.brand_name || p.provider_name || '').filter(Boolean);
    const maxDown = Math.max(0, ...(data?.data || []).map((p: any) => p.max_advertised_downstream_speed || 0));
    const maxUp = Math.max(0, ...(data?.data || []).map((p: any) => p.max_advertised_upstream_speed || 0));

    return {
      maxDown,
      maxUp,
      providers: [...new Set(providers)].slice(0, 5) as string[],
      status: 'loaded',
    };
  } catch {
    return { maxDown: 0, maxUp: 0, providers: [], status: 'unavailable' };
  }
}

// ---- USFWS Wetlands ----

async function fetchWetlandsData(lat: number, lng: number): Promise<PropertyIntelligence['wetlands']> {
  try {
    // National Wetlands Inventory via ArcGIS
    const url = `https://www.fws.gov/wetlands/arcgis/rest/services/Wetlands/MapServer/0/query?` +
      `geometry=${lng},${lat}&geometryType=esriGeometryPoint&spatialRel=esriSpatialRelIntersects` +
      `&outFields=WETLAND_TYPE,ATTRIBUTE&f=json&inSR=4326&outSR=4326`;

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return { hasWetlands: false, types: [], status: 'unavailable' };

    const data = await res.json();
    const features = data?.features || [];
    const types = [...new Set(features.map((f: any) => f.attributes?.WETLAND_TYPE || '').filter(Boolean))] as string[];

    return { hasWetlands: features.length > 0, types, status: 'loaded' };
  } catch {
    return { hasWetlands: false, types: [], status: 'unavailable' };
  }
}

// ---- Orchestrator ----

export async function fetchPropertyIntelligence(lat: number, lng: number): Promise<PropertyIntelligence> {
  const key = cacheKey(lat, lng);
  const existing = cache.get(key);
  if (existing && existing.soil?.status !== 'loading') return existing;

  const loading: PropertyIntelligence = {
    soil: { name: '', drainageClass: '', capabilityClass: '', farmlandClass: '', status: 'loading' },
    flood: { zone: '', zoneSubtype: '', status: 'loading' },
    water: { violations: 0, facilities: 0, facilityNames: [], status: 'loading' },
    toxics: { sites: [], status: 'loading' },
    broadband: { maxDown: 0, maxUp: 0, providers: [], status: 'loading' },
    wetlands: { hasWetlands: false, types: [], status: 'loading' },
  };
  cache.set(key, loading);

  const [soil, flood, water, toxics, broadband, wetlands] = await Promise.all([
    fetchSoilData(lat, lng),
    fetchFloodData(lat, lng),
    fetchWaterData(lat, lng),
    fetchToxicData(lat, lng),
    fetchBroadbandData(lat, lng),
    fetchWetlandsData(lat, lng),
  ]);

  const result: PropertyIntelligence = { soil, flood, water, toxics, broadband, wetlands };
  cache.set(key, result);
  return result;
}

// ---- Display helpers ----

export function floodRiskLevel(zone: string): { label: string; color: string } {
  const z = zone.toUpperCase();
  if (z === 'X' || z === 'AREA OF MINIMAL FLOOD HAZARD') return { label: 'Minimal risk', color: '#16a34a' };
  if (z.startsWith('A') || z.startsWith('V')) return { label: 'High risk', color: '#dc2626' };
  if (z === 'B' || z === 'SHADED X') return { label: 'Moderate risk', color: '#ca8a04' };
  return { label: zone, color: '#6b7280' };
}

export function soilRating(capClass: string): { label: string; color: string } {
  const c = capClass.replace(/[^IViv0-9]/g, '').toUpperCase();
  if (c === 'I' || c === 'II' || c === '1' || c === '2') return { label: 'Prime farmland', color: '#16a34a' };
  if (c === 'III' || c === '3') return { label: 'Good farmland', color: '#65a30d' };
  if (c === 'IV' || c === '4') return { label: 'Fair farmland', color: '#ca8a04' };
  return { label: capClass || 'Unknown', color: '#6b7280' };
}

/**
 * Only links that truly require visiting another site (no free API available).
 */
export function getExternalLinks(listing: { state: string; county: string; city: string; lat?: number; lng?: number }) {
  const { state, county, city } = listing;
  return [
    { label: `${county || state} Tax Assessor`, url: `https://www.google.com/search?q=${encodeURIComponent(`${county || ''} county ${state} property tax assessor`)}`, desc: 'County property tax records (no unified API exists)' },
    { label: 'USDA Loan Eligibility', url: 'https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do', desc: 'Check USDA rural development loan eligibility' },
    { label: 'Web Soil Survey (detailed)', url: 'https://websoilsurvey.nrcs.usda.gov/app/', desc: 'Draw your own area for a full USDA soil report' },
    { label: 'State Wildlife Agency', url: `https://www.google.com/search?q=${encodeURIComponent(`${state} department fish wildlife game hunting`)}`, desc: 'Hunting, fishing, wildlife management' },
    { label: 'Nearby Hospitals', url: `https://www.google.com/maps/search/hospital+near+${encodeURIComponent(`${city || county || ''}, ${state}`)}`, desc: 'Medical facilities nearby' },
  ];
}
