// Builds apps/worker/src/sources/nj-towns.ts, the towns of the New Jersey counties that `nj-parcels-rest-of-nj-parking`
// covers (ADR-0020), by the municipality code the parcel layer uses (`PCL_MUN`), from NJOGIS's municipal boundaries.
// A town is named as people say it ("Township of Long Hill" is Long Hill), unless another New Jersey town shares that
// name ("Washington" is a township in four counties and a borough in one), when its full name is kept ("Washington
// Township"); where even that repeats, its facility IDs also carry the county ("washington-township-morris").
// Hudson's, Essex's, and Bergen's towns are written out in nj-parcels-parking.ts and aren't touched. Every town's official
// label ("Oradell Borough") is written too, by code, so other sources' labels read as our names (S4-44).
// Run: node scripts/build-nj-towns.ts
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const OUT = fileURLToPath(new URL('../apps/worker/src/sources/nj-towns.ts', import.meta.url));
const NJ_MUNICIPALITIES = 'https://services2.arcgis.com/XVOqAjTOJ5P6ngMu/arcgis/rest/services/NJ_Municipalities_3857/FeatureServer/0/query';
const USER_AGENT = 'nyc-nj-parking build-nj-towns';
/** Written out by hand earlier (ADR-0015, ADR-0018, ADR-0019). */
const DONE = new Set(['HUDSON', 'ESSEX', 'BERGEN']);

interface Municipality {
  code: string;
  county: string;
  label: string;
  short: string;
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
/** A TypeScript string literal in single quotes. */
const quote = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

async function municipalities(): Promise<Municipality[]> {
  const body = new URLSearchParams({
    where: '1=1',
    outFields: 'MUN_CODE,COUNTY,MUN_LABEL,GNIS_NAME',
    orderByFields: 'MUN_CODE',
    returnGeometry: 'false',
    resultRecordCount: '2000',
    f: 'json',
  });
  const response = await fetch(NJ_MUNICIPALITIES, { method: 'POST', body, headers: { 'user-agent': USER_AGENT } });
  if (!response.ok) throw new Error(`NJOGIS answered ${response.status}`);
  const data = await response.json() as { exceededTransferLimit?: boolean; features: { attributes: Record<string, string | null> }[] };
  if (data.exceededTransferLimit) throw new Error('more municipalities than one query returns');
  return data.features.map(({ attributes: a }) => {
    const label = String(a.MUN_LABEL).trim();
    // "Township of Long Hill" → "Long Hill"; "City of Atlantic City" → "Atlantic City".
    const gnis = String(a.GNIS_NAME ?? '').replace(/^(Borough|Township|City|Town|Village) of /i, '').trim();
    const short = gnis || label.replace(/\s+(Township|Borough|Town|City|Village)$/i, '').trim();
    return { code: String(a.MUN_CODE).trim(), county: String(a.COUNTY).trim().toUpperCase(), label, short };
  });
}

const all = await municipalities();
const count = (values: string[]) => values.reduce((map, value) => map.set(value, (map.get(value) ?? 0) + 1), new Map<string, number>());
const shorts = count(all.map((town) => town.short));
const labels = count(all.map((town) => town.label));
if (all.length < 560 || new Set(all.map((town) => town.code)).size !== all.length) throw new Error(`unexpected municipalities: ${all.length}`);

const countyNames = new Set(all.map((town) => town.county));
/** Short names that don't read as a place by themselves ("Lower" is Lower Township; "Delaware" is also a state). */
const NOT_A_NAME_ALONE = new Set(['Lower', 'Middle', 'Upper', 'Commercial', 'Elk', 'Green', 'White', 'Delaware']);
const keepsFullName = (town: Municipality) =>
  (shorts.get(town.short) ?? 0) > 1 || NOT_A_NAME_ALONE.has(town.short)
  // "Gloucester" would read as the county; a city named after its county is called by that name (Camden, Salem, Cape May).
  || (countyNames.has(town.short.toUpperCase()) && !/ City$/.test(town.label));

const counties = new Map<string, string[]>();
for (const town of all.filter((town) => !DONE.has(town.county))) {
  const name = keepsFullName(town) ? town.label : town.short;
  const key = (labels.get(town.label) ?? 0) > 1 && name === town.label ? `${slug(name)}-${slug(town.county)}` : slug(name);
  const line = `    '${town.code}': { name: ${quote(name)}, key: '${key}' },`;
  counties.set(town.county, [...(counties.get(town.county) ?? []), line]);
}

const source = `// Built by scripts/build-nj-towns.ts from NJOGIS's municipal boundaries (ADR-0020). Don't edit by hand: change the
// script and run it again.

/** A county's towns by municipality code, and how their facility IDs start. */
export type Towns = Readonly<Record<string, { name: string; key: string }>>;

/** The towns of the counties \`nj-parcels-rest-of-nj-parking\` covers, by county as the parcel layer writes it. */
export const REST_OF_NJ_TOWNS: Readonly<Record<string, Towns>> = {
${[...counties.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([county, lines]) => `  '${county}': {\n${lines.join('\n')}\n  },`).join('\n')}
};

/** Every New Jersey town's official label (MUN_LABEL) and county, by municipality code, in all 21 counties (S4-44). */
export const NJ_MUNICIPAL_LABELS: Readonly<Record<string, { label: string; county: string }>> = {
${all.map((town) => `  '${town.code}': { label: ${quote(town.label)}, county: ${quote(town.county)} },`).join('\n')}
};
`;
writeFileSync(OUT, source);
console.log(`${counties.size} counties, ${[...counties.values()].flat().length} towns → ${OUT}`);
