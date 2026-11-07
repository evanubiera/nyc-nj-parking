// S4-19: Union City's municipal parking lots, from the Union City Parking Authority's Parking page (specs/06,
// "Union City"). The page lists each lot's name, where it is, and who may park; the lots for permit holders only are
// left out. It has no coordinates, so each lot was placed once on its tax parcels (LOCATIONS); a lot the page adds
// that isn't placed counts as a row that can't be read (ING-10). No terms are stated; admitted without asking first
// (ADR-0014), and it comes out if the Authority objects.
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const UCPA_PARKING_PAGE = 'https://www.ucpanj.org/Parking';

export const unionCityParkingLots: SourceDefinition = {
  id: 'union-city-parking-lots',
  publisher: 'Union City Parking Authority',
  title: 'Parking Lots: Municipal Lot Locations',
  datasetUrl: UCPA_PARKING_PAGE,
  // The site states no terms (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: UCPA_PARKING_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'names_reformatted', 'no_hourly_parking_excluded'],
  // The page changes rarely. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '25 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'union-city-parking-lots', normalizeUnionCity(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(UCPA_PARKING_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  // Nothing on the page is an email address today; removed all the same, as for any page we store (ING-2).
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/**
 * Where each lot is, checked on 2026-11-07: the public parcels the State's tax records describe as parking on the
 * block the page names (the mean where there are several).
 */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  '25th Street Lot': { lat: 40.76828, lng: -74.03284, basis: 'parcel 0910_137_11, 515 25th St, "parking lot / parking areas"; block 137 is between West St and Bergenline Ave' },
  '35th-36th Street Lot': { lat: 40.77443, lng: -74.02868, basis: 'parcel 0910_213_28, 516 35th St, "parking lot / parking area"; block 213 faces 35th and 36th Streets' },
  '39th-38th Street Deck': { lat: 40.77581, lng: -74.02721, basis: 'parcel 0910_224_23, 506-18 38th St, "parking garage / parking area"' },
  '41st-42th Street Lot': { lat: 40.77749, lng: -74.02618, basis: 'parcel 0910_239_20, 518 41st St, "parking-gazebo / parking areas"; block 239 faces 41st and 42nd Streets' },
  '44th-45th Street Lot': { lat: 40.77874, lng: -74.02325, basis: 'block 256, eight parcels described as parking, two of them "Parking Auth of U.C."' },
  '47th-48th Street Lot': { lat: 40.78125, lng: -74.02266, basis: 'block 266, 508 and 510 47th St, "parking / parking area(s)"' },
};

/** The page writes "41th" and "42th"; ordinals are corrected in names and addresses (modification `names_reformatted`). */
export function fixOrdinals(text: string): string {
  return text.replace(/\b(\d+)(st|nd|rd|th)\b/gi, (_, number: string) => {
    const n = Number(number);
    const suffix = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
    return `${number}${suffix}`;
  });
}

interface ListedLot {
  name: string;
  where: string;
  rule: string;
}

/** The lots under "Municipal Lot Locations": a name, "Located …", and who may park there. */
export function listedLots(text: string): ListedLot[] {
  const start = text.indexOf('\nMunicipal Lot Locations\n');
  const end = text.indexOf('\nMeetings\n', start);
  if (start < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no "Municipal Lot Locations" section');
  const lines = text.slice(start, end).split('\n').filter(Boolean);
  const lots: ListedLot[] = [];
  lines.forEach((line, index) => {
    const next = lines[index + 1] ?? '';
    if (!/^Located\b/i.test(next)) return;
    lots.push({ name: line, where: next.replace(/^Located (at |on )?/i, ''), rule: lines[index + 2] ?? '' });
  });
  return lots;
}

export function normalizeUnionCity(body: Uint8Array): Normalized {
  const lots = listedLots(pageText(body));
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const lot of lots) {
    // Lots for permit holders only aren't for visitors (modification `no_hourly_parking_excluded`).
    if (/permit holders only/i.test(lot.rule)) continue;
    const location = LOCATIONS[lot.name];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const name = fixOrdinals(lot.name);
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    records.push({
      recordId: slug,
      facilityKey: `union-city-${slug}`,
      priority: 1,
      name,
      matchTokens: matchTokens(name),
      kind: /\bdeck\b/i.test(name) ? 'garage' : 'lot',
      // A city's own parking authority runs the city's lots: city-run (specs/03).
      operatorName: 'Union City Parking Authority',
      operatorType: 'municipal',
      addressLine: fixOrdinals(lot.where.charAt(0).toUpperCase() + lot.where.slice(1)),
      locality: 'Union City',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: null,
      officialUrl: UCPA_PARKING_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length, records, invalidRows };
}
