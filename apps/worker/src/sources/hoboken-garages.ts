// S4-13: Hoboken's municipal garages, from the City's "Municipal Garages and Lots" page (specs/06, "Hoboken",
// ADR-0015). The page's availability table gives each garage's address, capacity, and whether it takes transient
// (hourly) parkers; only the garages it lists as available are shown. The page has no coordinates, so each garage
// was placed once by hand (LOCATIONS). It states no terms; it's admitted without asking first (ADR-0014, SRC-7).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { fragmentText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const HOBOKEN_GARAGES_PAGE = 'https://www.hobokennj.gov/resources/municipal-garages';

export const hobokenGarages: SourceDefinition = {
  id: 'hoboken-garages',
  publisher: 'City of Hoboken',
  title: 'Municipal Garages and Lots',
  datasetUrl: HOBOKEN_GARAGES_PAGE,
  // The page states no terms (SRC-7). Admitted, terms unstated (ADR-0014).
  termsUrl: HOBOKEN_GARAGES_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'names_reformatted', 'no_hourly_parking_excluded'],
  // Whether a garage takes hourly parkers can change, so the page is checked daily; unchanged data is skipped (ING-7).
  schedule: '15 6 * * *',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'hoboken-garages', normalizeHoboken(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(HOBOKEN_GARAGES_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return {
    // The page lists staff email addresses, which we don't keep (ING-2).
    body: withoutEmailAddresses(page.body),
    contentType: page.contentType,
    upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
  };
}

/**
 * Where each garage is, checked on 2026-11-06: the public parcel the State's tax records describe as that garage, or
 * the State's geocoder where none does. The names are as the page writes them elsewhere ("Midtown Garage").
 */
export const LOCATIONS: Record<string, { name: string; lat: number; lng: number; basis: string }> = {
  'Garage B': { name: 'Garage B', lat: 40.73804, lng: -74.02905, basis: 'parcel 0905_224_2, 112 River St, "GARAGE#B-810 PS"' },
  'Garage D': { name: 'Garage D', lat: 40.73909, lng: -74.02873, basis: 'parcel 0905_225_2, 210 River St, "GARAGE#D-486 PS"' },
  'Garage G': { name: 'Garage G', lat: 40.74041, lng: -74.02839, basis: 'NJ_Geocode, 315 Hudson Street' },
  Midtown: { name: 'Midtown Garage', lat: 40.74151, lng: -74.03482, basis: 'parcel 0905_52_18.01, 328 Clinton St, "MIDTOWN GARAGE"' },
};

const HEADER = ['Name', 'Address', 'Capacity', 'Monthly', 'Transient'];

export interface GarageRow {
  name: string;
  address: string;
  capacity: number | null;
  transient: string;
}

/**
 * The rows of the page's availability table; null for a row that can't be read (ING-10). A page without the table
 * fails the run rather than guess (ING-3).
 */
export function garageRows(html: string): (GarageRow | null)[] {
  for (const table of html.match(/<table\b[\s\S]*?<\/table>/gi) ?? []) {
    const rows = (table.match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []).map((row) =>
      [...row.matchAll(/<t([hd])\b[^>]*>([\s\S]*?)<\/t\1>/gi)].map((cell) => fragmentText(cell[2]!)));
    if (rows[0]?.join('|') !== HEADER.join('|')) continue;
    return rows
      .slice(1)
      .filter((cells) => cells.some(Boolean))
      .map((cells) => {
        const [name, address, capacity, , transient] = cells;
        if (cells.length !== HEADER.length || !name || !address || !/^\d+$/.test(capacity ?? '')) return null;
        return { name, address, capacity: Number(capacity), transient: transient ?? '' };
      });
  }
  throw new IngestionError('normalize.unexpected_format', 'no garage availability table');
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function normalizeHoboken(body: Uint8Array): Normalized {
  const rows = garageRows(new TextDecoder().decode(body));
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const row of rows) {
    // Only garages the page lists as taking transient (hourly) parkers (modification `no_hourly_parking_excluded`).
    if (row && row.transient.toLowerCase() !== 'available') continue;
    const location = row ? LOCATIONS[row.name] : undefined;
    if (!row || !location) {
      invalidRows += 1;
      continue;
    }
    records.push({
      recordId: slug(row.name),
      facilityKey: `hoboken-${slug(location.name)}`,
      priority: 1,
      name: location.name,
      matchTokens: matchTokens(location.name),
      kind: 'garage',
      operatorName: 'Hoboken Parking Utility',
      operatorType: 'municipal',
      addressLine: row.address,
      locality: 'Hoboken',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: row.capacity,
      officialUrl: HOBOKEN_GARAGES_PAGE,
      // The page's transient rates are evening specials by time of entry, and its hours are the office's.
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: rows.length, records, invalidRows };
}
