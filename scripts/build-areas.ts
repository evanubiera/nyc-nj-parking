// Builds apps/worker/src/data/areas.json: the areas a person can search as a whole (ADR-0021), New Jersey's 21 counties
// from NJOGIS and New York City's five boroughs from NYC Planning (water areas included, so a pier is in its borough),
// each outline simplified to about 20 m. The worker gives each facility its area from these when it rebuilds them.
// Run: node scripts/build-areas.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../apps/worker/src/data/areas.json', import.meta.url));
const NJ_COUNTIES = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Counties_3857/FeatureServer/0/query';
const NYC_BOROUGHS = 'https://data.cityofnewyork.us/resource/wh2p-dxnf.geojson';
const USER_AGENT = 'nyc-nj-parking build-areas';
/** Simplification tolerance, in degrees of latitude (about 20 m). */
const TOLERANCE = 0.00018;

type Ring = [number, number][];
interface Area {
  /** As the API names it (`AreaId` in api/openapi.yaml), such as "nj-cape-may" or "ny-staten-island". */
  id: string;
  name: string;
  state: 'NJ' | 'NY';
  /** Every ring of every part, [lng, lat]; a point is inside when an odd number of rings contain it. */
  rings: Ring[];
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (text: string) => text.toLowerCase().replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
const round = (value: number) => Math.round(value * 100000) / 100000;

async function json(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { 'user-agent': USER_AGENT, ...init?.headers } });
  if (!response.ok) throw new Error(`${new URL(url).host} answered ${response.status}`);
  return response.json();
}

/** Douglas–Peucker, in degrees with longitude scaled to its length at the ring's latitude. */
function simplify(ring: Ring): Ring {
  if (ring.length <= 4) return ring;
  const scale = Math.cos((ring[0]![1] * Math.PI) / 180);
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    const [ax, ay] = [ring[first]![0] * scale, ring[first]![1]];
    const [bx, by] = [ring[last]![0] * scale, ring[last]![1]];
    const length = Math.hypot(bx - ax, by - ay);
    let farthest = -1;
    let distance = 0;
    for (let index = first + 1; index < last; index += 1) {
      const [px, py] = [ring[index]![0] * scale, ring[index]![1]];
      const d = length === 0 ? Math.hypot(px - ax, py - ay) : Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / length;
      if (d > distance) [farthest, distance] = [index, d];
    }
    if (farthest > 0 && distance > TOLERANCE) {
      keep[farthest] = 1;
      stack.push([first, farthest], [farthest, last]);
    }
  }
  const kept = ring.filter((_, index) => keep[index]);
  return kept.length >= 4 ? kept.map(([lng, lat]) => [round(lng), round(lat)] as [number, number]) : [];
}

async function newJersey(): Promise<Area[]> {
  const body = new URLSearchParams({ where: '1=1', outFields: 'COUNTY,COUNTY_LABEL', outSR: '4326', returnGeometry: 'true', f: 'json' });
  const data = await json(NJ_COUNTIES, { method: 'POST', body });
  if (data.exceededTransferLimit) throw new Error('more counties than one query returns');
  return data.features.map((feature: { attributes: Record<string, string>; geometry: { rings: Ring[] } }) => ({
    id: `nj-${slug(feature.attributes.COUNTY!)}`,
    name: feature.attributes.COUNTY_LABEL!.trim(),
    state: 'NJ',
    rings: feature.geometry.rings.map(simplify).filter((ring) => ring.length > 0),
  }));
}

async function newYorkCity(): Promise<Area[]> {
  const data = await json(NYC_BOROUGHS);
  return data.features.map((feature: { properties: Record<string, string>; geometry: { coordinates: Ring[][] } }) => ({
    id: `ny-${slug(feature.properties.boroname!)}`,
    name: titleCase(feature.properties.boroname!),
    state: 'NY',
    rings: feature.geometry.coordinates.flat().map(simplify).filter((ring) => ring.length > 0),
  }));
}

const areas = [...(await newJersey()), ...(await newYorkCity())].sort((a, b) => a.id.localeCompare(b.id));
if (areas.length !== 26) throw new Error(`expected 21 counties and 5 boroughs, got ${areas.length}`);
const about = 'Built by scripts/build-areas.ts (ADR-0021). NJ counties: NJOGIS, County Boundaries of NJ. NYC boroughs: NYC Planning, Borough Boundaries (water areas included).';
writeFileSync(OUT, `${JSON.stringify({ about, builtOn: new Date().toISOString().slice(0, 10), areas })}\n`);
console.log(`${areas.length} areas, ${areas.reduce((sum, area) => sum + area.rings.reduce((s, ring) => s + ring.length, 0), 0)} points → ${OUT}`);
