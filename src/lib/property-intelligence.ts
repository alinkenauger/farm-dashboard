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
  water?: {
    violations: number;
    facilities: number;
    facilityNames: string[];
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
 * Query EPA ECHO for water quality violations and facilities near a point.
 * 3-mile radius search for facilities with Clean Water Act violations.
 */
async function fetchWaterData(lat: number, lng: number): Promise<PropertyIntelligence['water']> {
  try {
    // EPA ECHO Facility search within 3 miles
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
      .map((f: any) => f.FacName || 'Unknown facility')
      .filter((n: string) => n !== 'Unknown facility');

    const totalViolations = facilities.reduce(
      (sum: number, f: any) => sum + (parseInt(f.CWAQtrsInNC) || 0), 0
    );

    return {
      violations: totalViolations,
      facilities: facilities.length,
      facilityNames,
      status: 'loaded',
    };
  } catch {
    return { violations: 0, facilities: 0, facilityNames: [], status: 'unavailable' };
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
    water: { violations: 0, facilities: 0, facilityNames: [], status: 'loading' },
  };
  cache.set(key, loading);

  // Fetch in parallel
  const [soil, flood, water] = await Promise.all([
    fetchSoilData(lat, lng),
    fetchFloodData(lat, lng),
    fetchWaterData(lat, lng),
  ]);

  const result: PropertyIntelligence = { soil, flood, water };
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
/**
 * Generate research links for a property location.
 * These open external tools pre-filled with the property's coordinates or location.
 */
export function getResearchLinks(listing: { state: string; county: string; city: string; lat?: number; lng?: number }) {
  const { state, county, city, lat, lng } = listing;
  const location = `${city ? city + ', ' : ''}${county ? county + ' County, ' : ''}${state}`;

  return [
    {
      category: 'Tax & Property Records',
      links: [
        { label: `${county || state} Tax Assessor`, url: `https://www.google.com/search?q=${encodeURIComponent(`${county || ''} county ${state} property tax assessor lookup`)}`, desc: 'County property tax records and assessed values' },
        { label: 'USDA Property Eligibility', url: `https://eligibility.sc.egov.usda.gov/eligibility/welcomeAction.do`, desc: 'Check USDA rural development loan eligibility' },
      ],
    },
    {
      category: 'Water & Environmental',
      links: [
        { label: 'EPA Water Quality', url: lat && lng ? `https://mywaterway.epa.gov/community/${lat}/${lng}` : `https://mywaterway.epa.gov/community/${encodeURIComponent(location)}`, desc: 'Local waterway health, impairments, and pollution sources' },
        { label: 'EPA Envirofacts', url: lat && lng ? `https://enviro.epa.gov/enviro/em/locator/index.html?lx=${lng}&ly=${lat}` : `https://enviro.epa.gov/`, desc: 'Toxic releases, Superfund sites, brownfields nearby' },
        { label: 'USGS Water Resources', url: `https://waterdata.usgs.gov/nwis/uv?search_criteria=lat_long_bounding_box&submitted_form=introduction`, desc: 'Stream gauges, groundwater levels, water quality data' },
        { label: 'Well Water Quality', url: `https://www.google.com/search?q=${encodeURIComponent(`${county || ''} county ${state} well water quality report`)}`, desc: 'County well water testing and quality reports' },
      ],
    },
    {
      category: 'Wildlife & Conservation',
      links: [
        { label: 'USFWS Wetlands', url: lat && lng ? `https://fwsprimary.wim.usgs.gov/wetlands/apps/wetlands-mapper/?zoom=13&center=${lng},${lat}` : `https://www.fws.gov/program/national-wetlands-inventory/wetlands-mapper`, desc: 'National Wetlands Inventory map' },
        { label: 'State Wildlife Agency', url: `https://www.google.com/search?q=${encodeURIComponent(`${state} department of fish wildlife game species`)}`, desc: 'Hunting, fishing, and wildlife management info' },
        { label: 'Endangered Species', url: lat && lng ? `https://ecos.fws.gov/ipac/location/index` : `https://ecos.fws.gov/ipac/`, desc: 'USFWS IPaC threatened and endangered species' },
      ],
    },
    {
      category: 'Soil & Agriculture',
      links: [
        { label: 'Web Soil Survey', url: `https://websoilsurvey.nrcs.usda.gov/app/`, desc: 'Detailed USDA soil maps and reports' },
        { label: 'Crop History', url: `https://nassgeodata.gmu.edu/CropScape/`, desc: 'USDA CropScape: what crops were grown on this land' },
        { label: 'Farmland Value', url: `https://www.google.com/search?q=${encodeURIComponent(`${county || ''} county ${state} farmland value per acre ${new Date().getFullYear()}`)}`, desc: 'Local farmland market values' },
      ],
    },
    {
      category: 'Area Research',
      links: [
        { label: 'Broadband Availability', url: `https://broadbandmap.fcc.gov/location-summary/fixed?speed=25_3&latlon=${lat || ''},${lng || ''}`, desc: 'FCC broadband map: internet availability' },
        { label: 'School Ratings', url: `https://www.google.com/search?q=${encodeURIComponent(`${city || county || ''} ${state} school ratings`)}`, desc: 'Nearby school quality ratings' },
        { label: 'Crime Statistics', url: `https://www.google.com/search?q=${encodeURIComponent(`${county || ''} county ${state} crime rate statistics`)}`, desc: 'Area crime and safety data' },
        { label: 'Nearby Hospitals', url: `https://www.google.com/maps/search/hospital+near+${encodeURIComponent(location)}`, desc: 'Hospitals and medical facilities nearby' },
      ],
    },
  ];
}

export function soilRating(capClass: string): { label: string; color: string } {
  const c = capClass.replace(/[^IViv0-9]/g, '').toUpperCase();
  if (c === 'I' || c === 'II' || c === '1' || c === '2') return { label: 'Prime farmland', color: '#16a34a' };
  if (c === 'III' || c === '3') return { label: 'Good farmland', color: '#65a30d' };
  if (c === 'IV' || c === '4') return { label: 'Fair farmland', color: '#ca8a04' };
  return { label: capClass || 'Unknown', color: '#6b7280' };
}
