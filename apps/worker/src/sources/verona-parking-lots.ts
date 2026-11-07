// S4-30: Verona's two municipal parking lots, from the Township's Municipal Parking page (specs/06, "Verona"). The page
// says how to get into each lot and how many metered and permit spaces it has. It has no coordinates, so each lot was
// placed once on its tax parcel (LOCATIONS). No terms are stated; admitted without asking first (ADR-0014).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const VERONA_PARKING_PAGE = 'https://www.veronanj.org/MunicipalParking';

export const veronaParkingLots: SourceDefinition = {
  id: 'verona-parking-lots',
  publisher: 'Township of Verona',
  title: 'Municipal Parking',
  datasetUrl: VERONA_PARKING_PAGE,
  // The site states no terms (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: VERONA_PARKING_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records'],
  schedule: '50 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'verona-parking-lots', normalizeVerona(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(VERONA_PARKING_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/** Where each lot is, by its number, checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<number, { lat: number; lng: number; basis: string }> = {
  1: { lat: 40.83232, lng: -74.24491, basis: 'parcel 0720_1703_65, 550 Bloomfield Ave rear, "parking area", on the block of H.B. Whitehorne Middle School (600 Bloomfield Ave)' },
  2: { lat: 40.83314, lng: -74.2477, basis: 'parcel 0720_1702_20, 15 Grove Ave, "parking area", just north of Bloomfield Ave' },
};

export interface ListedLot {
  number: number;
  access: string;
  metered: number;
  permit: number;
}

/** "Municipal Lot N", then "can be accessed via|from …." and "Lot N contains M metered parking spaces and P permit …". */
export function listedLots(text: string): ListedLot[] {
  const lots = [...text.matchAll(/\nMunicipal Lot (\d+)\ncan be accessed (?:via|from) ([^\n]+?)\.(?: [^\n]*?)? Lot \1 contains (\d+) metered parking spaces and (\d+) permit parking spaces\./g)]
    .map((match) => ({ number: Number(match[1]), access: match[2]!.trim(), metered: Number(match[3]), permit: Number(match[4]) }));
  if (lots.length === 0) throw new IngestionError('normalize.unexpected_format', 'no lots in the expected wording');
  return lots;
}

export function normalizeVerona(body: Uint8Array): Normalized {
  const text = pageText(body);
  const lots = listedLots(text);
  // A lot heading whose description no longer reads as expected is a row that can't be read (ING-10).
  const headings = text.match(/\nMunicipal Lot \d+\n/g)?.length ?? 0;
  const records: SourceRecordInput[] = [];
  let invalidRows = headings - lots.length;
  for (const lot of lots) {
    const location = LOCATIONS[lot.number];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const name = `Municipal Lot ${lot.number}`;
    records.push({
      recordId: `lot-${lot.number}`,
      facilityKey: `verona-lot-${lot.number}`,
      priority: 1,
      name,
      matchTokens: matchTokens(name),
      kind: 'lot',
      operatorName: 'Township of Verona',
      operatorType: 'municipal',
      addressLine: lot.access.replace(/\boff of\b/, 'off'),
      locality: 'Verona',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      // Metered and permit spaces together; the page doesn't give the meters' hours or rates.
      spaces: lot.metered + lot.permit,
      officialUrl: VERONA_PARKING_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: headings, records, invalidRows };
}
