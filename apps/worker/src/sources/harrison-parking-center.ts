// S4-20: the Town of Harrison's parking garage by the PATH station, from the Police Department's Parking Permit
// Forms page, which lists it under "Parking For Red Bulls Events and Harrison Path Station" (specs/06, "Harrison").
// The page gives its name and address; it was placed once on its tax parcel (LOCATIONS). The site states no terms
// beyond a copyright notice; admitted without asking first (ADR-0014), and it comes out if Harrison objects.
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const HARRISON_PARKING_PAGE = 'https://townofharrison.com/223/Parking-Permits';

export const harrisonParkingCenter: SourceDefinition = {
  id: 'harrison-parking-center',
  publisher: 'Town of Harrison Police Department',
  title: 'Parking Permit Forms: Harrison Parking Center',
  datasetUrl: HARRISON_PARKING_PAGE,
  // The site's copyright notice is all it states (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: 'https://townofharrison.com/site/copyright',
  creditText: null,
  modificationCodes: ['locations_from_records'],
  schedule: '30 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'harrison-parking-center', normalizeHarrison(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(HARRISON_PARKING_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  // The page lists the permit office's email address, which we don't keep (ING-2).
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/** Where the garage is, checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  '355 Somerset Street': { lat: 40.7394, lng: -74.15685, basis: 'parcel 0904_117.01_1.05, 355 Somerset St, "parking area", class 15C' },
};

/** The garage's block on the page: its name, then "Address" and the street address on the next line. */
export function listedGarage(text: string): { name: string; address: string } {
  const match = /\n(Harrison Parking Center)\nAddress\n([^\n]+?),?\n/.exec(text);
  if (!match) throw new IngestionError('normalize.unexpected_format', 'no "Harrison Parking Center" address on the page');
  return { name: match[1]!, address: match[2]!.trim() };
}

export function normalizeHarrison(body: Uint8Array): Normalized {
  const garage = listedGarage(pageText(body));
  const location = LOCATIONS[garage.address];
  if (!location) return { rowsRead: 1, records: [], invalidRows: 1 };
  const record: SourceRecordInput = {
    recordId: 'harrison-parking-center',
    facilityKey: 'harrison-parking-center',
    priority: 1,
    name: garage.name,
    matchTokens: matchTokens(garage.name),
    kind: 'garage',
    operatorName: 'Town of Harrison',
    operatorType: 'municipal',
    addressLine: garage.address,
    locality: 'Harrison',
    region: 'NJ',
    timeZone: NEW_YORK_TIME,
    lat: location.lat,
    lng: location.lng,
    // The page says "Open 24/7", but opening hours don't reach the app yet; its spaces and rates aren't on the page.
    spaces: null,
    officialUrl: HARRISON_PARKING_PAGE,
    meterPeriods: [],
    rates: [],
    confirmed: true,
    lotNumber: null,
    withheldReason: null,
  };
  return { rowsRead: 1, records: [record], invalidRows: 0 };
}
