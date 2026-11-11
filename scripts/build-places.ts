// Builds apps/web/src/data/places.json, the towns and neighbourhoods that address search matches in the browser
// (ADR-0013, specs/06 "Address search"): New Jersey's municipalities from NJOGIS, and New York City's boroughs and
// neighbourhood names from the City's 2020 Neighborhood Tabulation Areas, and New York State's cities, towns, and
// villages from NYS GIS (ADR-0022), each at the centre of its area.
// Run: node scripts/build-places.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../apps/web/src/data/places.json', import.meta.url));
const NJ_MUNICIPALITIES = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Municipalities_3857/FeatureServer/0/query';
const NYC_NTAS = 'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=1000';
const NYS_CITIES_TOWNS = 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Civil_Boundaries/FeatureServer/6/query';
const NYS_VILLAGES = 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Civil_Boundaries/FeatureServer/7/query';
const USER_AGENT = 'nyc-nj-parking build-places';

export interface Place {
  /** What the suggestion shows, such as "Montclair Township" or "Astoria". */
  name: string;
  /** Other names that match, such as "Montclair". */
  aliases: string[];
  state: 'NJ' | 'NY';
  /** The county (NJ) or borough (NY), to tell places with the same name apart. */
  area: string;
  lat: number;
  lng: number;
  /** For ranking: 2020 population for NJ towns; null for NYC areas. */
  population: number | null;
}

const round = (value: number) => Math.round(value * 100000) / 100000;
const titleCase = (text: string) => text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'user-agent': USER_AGENT, ...init?.headers } });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/**
 * New York State's cities, towns, and villages outside New York City (ADR-0022), from NYS GIS. Named as New Jersey's
 * are, with the kind of place ("Buffalo City", "Islip Town", "Westfield Village"), and found by the bare name too.
 */
const NYC_COUNTIES = ['Bronx', 'Kings', 'New York', 'Queens', 'Richmond'];

async function newYorkState(): Promise<Place[]> {
  const places: Place[] = [];
  for (const [layer, kind] of [[NYS_CITIES_TOWNS, null], [NYS_VILLAGES, 'Village']] as const) {
    const body = new URLSearchParams({
      where: '1=1',
      // The villages layer has no MUNI_TYPE: every row is a village.
      outFields: kind ? 'NAME,COUNTY,POP2020' : 'NAME,MUNI_TYPE,COUNTY,POP2020',
      returnGeometry: 'true',
      // A coarse outline is enough for the middle of a place.
      maxAllowableOffset: '0.005',
      outSR: '4326',
      f: 'json',
    });
    const data = await json(layer, { method: 'POST', body });
    if (data.exceededTransferLimit) throw new Error('more places than one query returns');
    for (const feature of data.features as { attributes: Record<string, string | number>; geometry: { rings: number[][][] } }[]) {
      const a = feature.attributes;
      // A village in two counties names both ("Allegany, Steuben"): it's listed under the first. New York City itself,
      // in all five of its counties, is left out: its boroughs and neighbourhoods are listed already.
      const county = String(a.COUNTY).split(',')[0]!.trim();
      if (NYC_COUNTIES.includes(county)) continue;
      const points = feature.geometry.rings.flat();
      const name = String(a.NAME).trim();
      places.push({
        name: `${name} ${kind ?? titleCase(String(a.MUNI_TYPE))}`,
        aliases: [name],
        state: 'NY',
        area: `${county} County`,
        lat: round(points.reduce((sum, point) => sum + point[1]!, 0) / points.length),
        lng: round(points.reduce((sum, point) => sum + point[0]!, 0) / points.length),
        population: typeof a.POP2020 === 'number' ? a.POP2020 : null,
      });
    }
  }
  return places;
}

async function newJersey(): Promise<Place[]> {
  const body = new URLSearchParams({
    where: '1=1',
    outFields: 'MUN_LABEL,NAME,COUNTY,MUN_TYPE,POP2020',
    returnGeometry: 'false',
    returnCentroid: 'true',
    outSR: '4326',
    resultRecordCount: '2000',
    f: 'json',
  });
  const data = await json(NJ_MUNICIPALITIES, { method: 'POST', body });
  if (data.exceededTransferLimit) throw new Error('more municipalities than one query returns');
  return data.features.map((feature: { attributes: Record<string, string | number>; centroid: { x: number; y: number } }) => {
    const a = feature.attributes;
    const label = String(a.MUN_LABEL);
    // "Montclair Township" also matches "Montclair"; "Jersey City" stays as it is.
    const base = label.replace(/\s+(Township|Borough|Town|City|Village)$/i, '').trim();
    return {
      name: label,
      aliases: [...new Set([base, String(a.NAME)].filter((alias) => alias && alias !== label))],
      state: 'NJ',
      area: `${titleCase(String(a.COUNTY))} County`,
      lat: round(feature.centroid.y),
      lng: round(feature.centroid.x),
      population: typeof a.POP2020 === 'number' ? a.POP2020 : null,
    } satisfies Place;
  });
}

/** The mean of a polygon's corners: close enough to the middle of a neighbourhood to search from. */
function middle(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number] {
  const rings = geometry.type === 'MultiPolygon' ? (geometry.coordinates as number[][][][]).flat() : (geometry.coordinates as number[][][]);
  const points = rings.flat();
  const lng = points.reduce((sum, point) => sum + point[0]!, 0) / points.length;
  const lat = points.reduce((sum, point) => sum + point[1]!, 0) / points.length;
  return [lat, lng];
}

async function newYorkCity(): Promise<Place[]> {
  const data = await json(NYC_NTAS);
  const byName = new Map<string, { area: string; points: [number, number][] }>();
  const byBorough = new Map<string, [number, number][]>();
  for (const feature of data.features as { properties: Record<string, string>; geometry: Parameters<typeof middle>[0] }[]) {
    const { ntaname, boroname, ntatype } = feature.properties;
    if (!ntaname || !boroname || ntatype !== '0') continue; // residential areas only, not parks, airports, or cemeteries
    const point = middle(feature.geometry);
    byBorough.set(boroname, [...(byBorough.get(boroname) ?? []), point]);
    // "Astoria (East)-Woodside (North)" names two neighbourhoods: Astoria and Woodside.
    for (const part of ntaname.split('-')) {
      const name = part.replace(/\(.*?\)/g, '').trim();
      if (!name) continue;
      const entry = byName.get(`${name}|${boroname}`) ?? { area: boroname, points: [] };
      entry.points.push(point);
      byName.set(`${name}|${boroname}`, entry);
    }
  }
  const mean = (points: [number, number][]) => [points.reduce((s, p) => s + p[0], 0) / points.length, points.reduce((s, p) => s + p[1], 0) / points.length];
  const places: Place[] = [];
  for (const [borough, points] of byBorough) {
    const [lat, lng] = mean(points);
    const aliases = borough === 'Manhattan' ? ['New York', 'New York City'] : borough === 'Bronx' ? ['The Bronx'] : [];
    places.push({ name: borough, aliases, state: 'NY', area: 'New York City', lat: round(lat!), lng: round(lng!), population: null });
  }
  for (const [key, { area, points }] of byName) {
    const name = key.split('|')[0]!;
    if (byBorough.has(name)) continue;
    const [lat, lng] = mean(points);
    places.push({ name, aliases: [], state: 'NY', area, lat: round(lat!), lng: round(lng!), population: null });
  }
  return places;
}

const [nj, ny, nys] = await Promise.all([newJersey(), newYorkCity(), newYorkState()]);
const places = [...nj, ...ny, ...nys].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
writeFileSync(
  OUT,
  JSON.stringify(
    {
      about: 'Built by scripts/build-places.ts (ADR-0013, ADR-0022). NJ towns: NJOGIS, Municipal Boundaries of NJ. NYC areas: NYC Planning, 2020 Neighborhood Tabulation Areas. NY State cities, towns, and villages: NYS GIS, NYS Civil Boundaries.',
      builtOn: new Date().toISOString().slice(0, 10),
      places,
    },
    null,
    0,
  ) + '\n',
);
console.log(`${nj.length} NJ towns, ${ny.length} NYC boroughs and neighbourhoods, and ${nys.length} NY State places written to ${OUT}`);
