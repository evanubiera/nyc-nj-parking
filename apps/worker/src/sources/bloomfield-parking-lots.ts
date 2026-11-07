// S4-26: Bloomfield's metered parking lots, from the Bloomfield Parking Utility's "Meter Parking/Display & Go" page
// (specs/06, "Bloomfield"). The page's tables give each metered lot's rate, time limit, and enforcement hours. It has no
// coordinates, so each lot was placed once on its tax parcel (LOCATIONS). The site states no terms beyond a copyright
// line; admitted without asking first (ADR-0014), and it comes out if Bloomfield objects.
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const BLOOMFIELD_METERS_PAGE = 'https://bloomfieldparking.org/pay-display-go/';

export const bloomfieldParkingLots: SourceDefinition = {
  id: 'bloomfield-parking-lots',
  publisher: 'Township of Bloomfield Parking Utility',
  title: 'Meter Parking/Display & Go',
  datasetUrl: BLOOMFIELD_METERS_PAGE,
  // The site states no terms beyond a copyright line (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: BLOOMFIELD_METERS_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'rates_converted_to_hourly'],
  schedule: '35 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'bloomfield-parking-lots', normalizeBloomfield(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(BLOOMFIELD_METERS_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  // The page's footer lists the Utility's email address, which we don't keep (ING-2).
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/** Where each lot is, checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  'Pitt St. Lot': { lat: 40.80687, lng: -74.1934, basis: 'parcel 0702_571_19, 19 Pitt & 20 Baldwin, "parking lot / parking lot 7"' },
  'Conger St Lot': { lat: 40.79253, lng: -74.19803, basis: 'parcel 0702_153_13.01, 305 Glenwood Ave, "parking lot / parking lot 3", the only public lot on the block that faces Conger St' },
};

/** Listed, but not placed with confidence on 2026-11-07 (specs/06); left out on purpose. */
export const UNLOCATED = new Set(['State St. Lot']);

const WORD_HOURS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, twelve: 12 };

export interface MeteredLot {
  name: string;
  centsPer: { cents: number; minutes: number };
  maxStayHours: number;
}

/**
 * The lots in the page's two meter tables: a name ending in "Lot", its rate ("25¢@15 min"), its time limit (the
 * 12-hour table, or "Two Hour Parking"), and its hours, which must read 8 am to 6 pm, Monday to Saturday (ING-3).
 */
export function meteredLots(text: string): MeteredLot[] {
  const start = text.indexOf('\n12 HOUR METER PARKING\n');
  const short = text.indexOf('\nSHORT TERM METER LOT PARKING\n', start);
  const end = text.indexOf('\nONSTREET METERED PARKING\n', short);
  if (start < 0 || short < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'the meter tables are gone');
  const lots: MeteredLot[] = [];
  const read = (section: string, twelveHour: boolean) => {
    const lines = section.split('\n');
    lines.forEach((line, index) => {
      if (!/\bLot\.?$/.test(line)) return;
      const following = lines.slice(index + 1, index + 5).join('\n');
      const rate = /^(\d+)¢@(\d+) min$/m.exec(following);
      const limit = /^(\w+) Hour Parking$/m.exec(following);
      const hours = /^8 am – 6 pm(\nMonday to Saturday| Monday to Saturday)/m.test(following);
      const maxStayHours = twelveHour ? 12 : WORD_HOURS[limit?.[1]?.toLowerCase() ?? ''];
      if (!rate || !hours || !maxStayHours) {
        throw new IngestionError('normalize.unexpected_format', `the wording for ${line} changed`);
      }
      lots.push({ name: line, centsPer: { cents: Number(rate[1]), minutes: Number(rate[2]) }, maxStayHours });
    });
  };
  read(text.slice(start, short), true);
  read(text.slice(short, end), false);
  return lots;
}

export function normalizeBloomfield(body: Uint8Array): Normalized {
  const lots = meteredLots(pageText(body));
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const lot of lots) {
    if (UNLOCATED.has(lot.name)) continue;
    const location = LOCATIONS[lot.name];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const slug = lot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    records.push({
      recordId: slug,
      facilityKey: `bloomfield-${slug}`,
      priority: 1,
      name: lot.name,
      matchTokens: matchTokens(lot.name),
      kind: 'lot',
      operatorName: 'Bloomfield Parking Utility',
      operatorType: 'municipal',
      addressLine: null,
      locality: 'Bloomfield',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: null,
      officialUrl: BLOOMFIELD_METERS_PAGE,
      // Monday to Saturday is days 1 to 32 (63).
      meterPeriods: [{ days: 63, startsAt: '08:00', endsAt: '18:00', maxStayMinutes: lot.maxStayHours * 60, vehicleClass: null,
        sourceText: `${lot.centsPer.cents}¢@${lot.centsPer.minutes} min, 8 am – 6 pm, Monday to Saturday` }],
      // "25¢@15 min" is $1.00 an hour (modification `rates_converted_to_hourly`).
      rates: [{ days: 63, startsAt: '08:00', endsAt: '18:00', kind: 'per_hour', upToMinutes: null,
        amountMinor: Math.round((lot.centsPer.cents * 60) / lot.centsPer.minutes), currency: 'USD' }],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length, records, invalidRows };
}
