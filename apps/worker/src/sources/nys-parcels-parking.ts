// S5-3: unconfirmed parking sites in New York State, from the State's public tax parcels (ADR-0022, specs/06 "New York
// State"). Unlike New Jersey's layer (ADR-0012), New York's names each parcel's owner and the kind of owner, and gives
// parking its own property classes: 437 (a parking garage) and 438 (a parking lot). A site is one, or several touching,
// parking parcels that a county, city, town, or village owns. Owning a lot doesn't say whether the public may park
// there, so every site is unconfirmed, with operator type `unknown` and no official page (REC-9). The layer covers the
// 38 counties that let the State share their parcels; New York City's boroughs use other classes and aren't read.
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { metersBetween } from '../facilities/cluster.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { titleCase } from '../normalize/names.ts';
import { parseJson, queryArcgisLayer } from './arcgis.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import { inNewYorkState } from './nys.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const NYS_PARCELS_SERVICE = 'https://gisservices.its.ny.gov/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer';
const LAYER = `${NYS_PARCELS_SERVICE}/1`;

/**
 * Parking garages and lots that a county (3), city (4), town (5), or village (6) owns, or two of them together (7).
 * Not the State's (2), mostly its office workers' lots in Albany; the federal government's (1), mostly post offices';
 * or school districts' (9). The owner's name is asked for only to leave out the odd body filed as a municipality.
 */
export const NYS_CANDIDATES_WHERE = "PROP_CLASS IN ('437','438') AND OWNER_TYPE IN ('3','4','5','6','7')";
const FIELDS = 'COUNTY_NAME,MUNI_NAME,SWIS,PRINT_KEY,PARCEL_ADDR,PROP_CLASS,OWNER_TYPE,PRIMARY_OWNER';

export const nysParcelsParking: SourceDefinition = {
  id: 'nys-parcels-parking',
  publisher: 'NYS Office of Information Technology Services, Geospatial Services, with the contributing counties and ORPTS',
  title: 'NYS Tax Parcels Public',
  datasetUrl: 'https://gis.ny.gov/parcels',
  // A disclaimer and a use limitation only (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: 'https://gis.ny.gov/parcels',
  creditText: null,
  modificationCodes: ['sites_from_parcels_by_owner', 'unconfirmed_public_use'],
  // Published once a year. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '25 6 * * 5',
  fetch: fetchParcels,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'nys-parcels-parking', normalizeNysParcels(snapshot.body), snapshot.fetchedAt),
};

async function fetchParcels(http: UpstreamHttp): Promise<FetchedData> {
  const service = parseJson((await http.get(`${NYS_PARCELS_SERVICE}?f=json`)).body);
  const rows = await queryArcgisLayer(http, LAYER, {
    where: NYS_CANDIDATES_WHERE,
    outFields: FIELDS,
    orderByFields: 'SWIS,PRINT_KEY',
    returnGeometry: 'true',
    geometryPrecision: '6',
  });
  return { body: rows.body, contentType: rows.contentType, upstreamUpdatedAt: publicationDate(service.serviceDescription) };
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
/** "Publication Date: May 2026." in the service's description is the data's date: the first of that month. */
export function publicationDate(description: unknown): Date | null {
  const match = typeof description === 'string' ? /Publication Date:\s*([A-Za-z]+)\s+(\d{4})/.exec(description.replace(/<[^>]+>/g, ' ')) : null;
  const month = match ? MONTHS.indexOf(match[1]!.toLowerCase()) : -1;
  return match && month >= 0 ? new Date(Date.UTC(Number(match[2]), month, 1)) : null;
}

/** Bodies filed as a municipality whose parking isn't the town's: a housing authority, an industrial development agency. */
const NOT_THE_TOWN = /HOUSING|\bIDA\b|INDUSTRIAL DEV/i;

interface Parcel {
  swis: string;
  printKey: string;
  owner: string;
  address: string;
  locality: string;
  garage: boolean;
  point: { lat: number; lng: number };
  corners: { lat: number; lng: number }[];
}

export function normalizeNysParcels(body: Uint8Array): Normalized {
  const list = parseJson(body).features;
  if (!Array.isArray(list)) throw new IngestionError('normalize.unexpected_format', 'response has no features');
  const parcels: Parcel[] = [];
  let invalidRows = 0;
  for (const feature of list as { attributes?: Record<string, unknown>; geometry?: { rings?: unknown } }[]) {
    const a = feature.attributes ?? {};
    const owner = text(a.PRIMARY_OWNER);
    if (NOT_THE_TOWN.test(owner)) continue;
    const corners = Array.isArray(feature.geometry?.rings)
      ? (feature.geometry.rings as unknown[]).flatMap((ring) => (Array.isArray(ring) ? ring : [])).flatMap((point) =>
          Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number' ? [{ lat: point[1], lng: point[0] }] : [])
      : [];
    const swis = text(a.SWIS);
    const printKey = text(a.PRINT_KEY);
    const address = text(a.PARCEL_ADDR);
    const locality = text(a.MUNI_NAME).replace(/,\s*(City|Town|Village)$/i, '');
    if (!swis || !printKey || !address || !locality || corners.length < 3) {
      invalidRows += 1;
      continue;
    }
    const point = {
      lat: corners.reduce((sum, corner) => sum + corner.lat, 0) / corners.length,
      lng: corners.reduce((sum, corner) => sum + corner.lng, 0) / corners.length,
    };
    if (!inNewYorkState(point)) {
      invalidRows += 1;
      continue;
    }
    parcels.push({ swis, printKey, owner: owner.toUpperCase().replace(/\s+/g, ' '), address, locality, garage: text(a.PROP_CLASS) === '437', point, corners });
  }

  const records = sitesOf(parcels).map((site): SourceRecordInput => {
    const first = site[0]!;
    return {
      recordId: `${first.swis}/${first.printKey}`,
      facilityKey: `nys-site-${first.swis}-${first.printKey.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      priority: 3,
      name: titleCase(first.address),
      // Never matched by name: an address isn't a lot's name (ING-14).
      matchTokens: [],
      kind: site.some((parcel) => parcel.garage) ? 'garage' : 'lot',
      operatorName: null,
      operatorType: 'unknown',
      addressLine: null,
      locality: first.locality,
      region: 'NY',
      timeZone: NEW_YORK_TIME,
      lat: site.reduce((sum, parcel) => sum + parcel.point.lat, 0) / site.length,
      lng: site.reduce((sum, parcel) => sum + parcel.point.lng, 0) / site.length,
      spaces: null,
      officialUrl: null,
      meterPeriods: [],
      rates: [],
      confirmed: false,
      lotNumber: null,
      withheldReason: null,
    };
  });
  return { rowsRead: list.length, records, invalidRows };
}

/** Parcels of one owner in one municipality whose outlines touch, joined transitively, as in New Jersey (ING-13). */
function sitesOf(parcels: Parcel[]): Parcel[][] {
  const touch = (a: Parcel, b: Parcel) =>
    metersBetween(a.point, b.point) <= 600 && a.corners.some((u) => b.corners.some((v) => metersBetween(u, v) <= 1.5));
  const groups = new Map<string, Parcel[]>();
  for (const parcel of [...parcels].sort((a, b) => (`${a.swis}/${a.printKey}` < `${b.swis}/${b.printKey}` ? -1 : 1))) {
    const key = `${parcel.swis}|${parcel.owner}`;
    groups.set(key, [...(groups.get(key) ?? []), parcel]);
  }
  const sites: Parcel[][] = [];
  for (const group of groups.values()) {
    const left = [...group];
    while (left.length > 0) {
      const site = [left.shift()!];
      for (let grew = true; grew; ) {
        grew = false;
        for (const parcel of [...left]) {
          if (site.some((member) => touch(parcel, member))) {
            site.push(parcel);
            left.splice(left.indexOf(parcel), 1);
            grew = true;
          }
        }
      }
      sites.push(site);
    }
  }
  return sites;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
