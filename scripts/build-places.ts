// Builds apps/web/src/data/places.json, the towns and neighbourhoods that address search matches in the browser
// (ADR-0013, specs/06 "Address search"): New Jersey's municipalities from NJOGIS, and New York City's boroughs and
// neighbourhood names from the City's 2020 Neighborhood Tabulation Areas, each at the centre of its area.
// Run: node scripts/build-places.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../apps/web/src/data/places.json', import.meta.url));
const NJ_MUNICIPALITIES = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Municipalities_3857/FeatureServer/0/query';
const NYC_NTAS = 'https://data.cityofnewyork.us/resource/9nt8-h7nd.geojson?$limit=1000';
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

const [nj, ny] = await Promise.all([newJersey(), newYorkCity()]);
const places = [...nj, ...ny].sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
writeFileSync(
  OUT,
  JSON.stringify(
    {
      about: 'Built by scripts/build-places.ts (ADR-0013). NJ towns: NJOGIS, Municipal Boundaries of NJ. NYC areas: NYC Planning, 2020 Neighborhood Tabulation Areas.',
      builtOn: new Date().toISOString().slice(0, 10),
      places,
    },
    null,
    0,
  ) + '\n',
);
console.log(`${nj.length} NJ towns and ${ny.length} NYC boroughs and neighbourhoods written to ${OUT}`);
