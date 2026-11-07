// S4-29: Nutley's municipal parking lots, from the Department of Public Works' Parking page (specs/06, "Nutley").
// The page lists nine numbered lots, where each is, and what parking it has ("3 Hr. Metered Parking", "Permit
// Parking"); lots with no metered parking are for permit holders only and are left out. It states the lots'
// enforcement hours and the meter rate for all of them. It has no coordinates, so each lot was placed once on its tax
// parcel (LOCATIONS). No terms are stated; admitted without asking first (ADR-0014).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const NUTLEY_PARKING_PAGE = 'https://nutleynj.org/parking';

export const nutleyParkingLots: SourceDefinition = {
  id: 'nutley-parking-lots',
  publisher: 'Township of Nutley Department of Public Works',
  title: 'Parking: Municipal Parking Lots',
  datasetUrl: NUTLEY_PARKING_PAGE,
  // The site states no terms (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: NUTLEY_PARKING_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'rates_converted_to_hourly', 'no_hourly_parking_excluded'],
  schedule: '45 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'nutley-parking-lots', normalizeNutley(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(NUTLEY_PARKING_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/** Where each metered lot is, by its number, checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<number, { lat: number; lng: number; basis: string }> = {
  1: { lat: 40.81621, lng: -74.16076, basis: 'parcel 0716_6200_11, 38 William St, "parking area", east of Franklin Ave' },
  2: { lat: 40.81553, lng: -74.16111, basis: 'parcel 0716_6201_2, 376 Centre St, "municipal pking lot", at William and Centre Streets' },
  4: { lat: 40.81791, lng: -74.15537, basis: 'parcel 0716_6402_7, 161 Chestnut St, "parking lot", between an administrative building and the health department' },
  5: { lat: 40.81408, lng: -74.16275, basis: 'parcel 0716_7501_4, 182 Franklin Ave, "parking area", across from 181 Franklin Ave' },
  7: { lat: 40.82415, lng: -74.15574, basis: 'parcel 0716_3100_37, 1 Franklin Terrace, "municipal pking lot", behind 507 Franklin Ave (Bella Luce)' },
  9: { lat: 40.82475, lng: -74.15451, basis: 'parcels 0716_3100_28 and _29, 535 Franklin Ave rear ("parking area") and 537 Franklin Ave' },
};

export interface ListedLot {
  number: number;
  where: string;
  meteredHours: number | null;
}

/** The lots table: "Municipal Parking Lot #N", where it is, then its kinds of parking. A change fails the run (ING-3). */
export function listedLots(text: string): ListedLot[] {
  const start = text.indexOf('\nMunicipal Parking Lots\nParking Lot\nLocation\nType of Parking\n');
  const end = text.indexOf('\nMeter Rates and Time Limits\n', start);
  if (start < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no "Municipal Parking Lots" table');
  const lines = text.slice(start, end).split('\n').filter(Boolean);
  const lots: ListedLot[] = [];
  lines.forEach((line, index) => {
    const head = /^Municipal Parking Lot #(\d+)$/.exec(line);
    if (!head) return;
    const rest: string[] = [];
    for (const next of lines.slice(index + 1)) {
      if (/^Municipal Parking Lot #\d+$/.test(next)) break;
      rest.push(next);
    }
    const kinds = rest.filter((entry) => /Parking$|\(School Days\)|Patrons|\(All Other Times\)/.test(entry));
    const metered = kinds.map((entry) => /^(\d+) Hr\. Metered Parking$/.exec(entry)).find(Boolean);
    lots.push({ number: Number(head[1]), where: rest.filter((entry) => !kinds.includes(entry)).join(' '), meteredHours: metered ? Number(metered[1]) : null });
  });
  return lots;
}

/** The lots are enforced around the clock, and a meter costs 25 cents per 15 minutes ($1.00 an hour). */
function lotRules(text: string): { centsPerHour: number } {
  if (!/\nMunicipal Parking Lots:\n24 hours per day, 7 days a week\n/.test(text)) {
    throw new IngestionError('normalize.unexpected_format', "the lots' enforcement hours changed");
  }
  const cash = /\nCash Payments:\n(\d+) cents per (\d+) minutes\./.exec(text);
  if (!cash) throw new IngestionError('normalize.unexpected_format', 'the meter rate changed');
  return { centsPerHour: Math.round((Number(cash[1]) * 60) / Number(cash[2])) };
}

export function normalizeNutley(body: Uint8Array): Normalized {
  const text = pageText(body);
  const { centsPerHour } = lotRules(text);
  const lots = listedLots(text);
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const lot of lots) {
    // Lots with no metered parking are for permit holders (modification `no_hourly_parking_excluded`).
    if (lot.meteredHours === null) continue;
    const location = LOCATIONS[lot.number];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const name = `Municipal Parking Lot #${lot.number}`;
    records.push({
      recordId: `lot-${lot.number}`,
      facilityKey: `nutley-lot-${lot.number}`,
      priority: 1,
      name,
      matchTokens: matchTokens(name),
      kind: 'lot',
      operatorName: 'Township of Nutley',
      operatorType: 'municipal',
      addressLine: lot.where,
      locality: 'Nutley',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: null,
      officialUrl: NUTLEY_PARKING_PAGE,
      meterPeriods: [{ days: 127, startsAt: '00:00', endsAt: '24:00', maxStayMinutes: lot.meteredHours * 60, vehicleClass: null,
        sourceText: `${lot.meteredHours} Hr. Metered Parking; lots enforced 24 hours per day, 7 days a week` }],
      // "25 cents per 15 minutes" is $1.00 an hour (modification `rates_converted_to_hourly`).
      rates: [{ days: 127, startsAt: '00:00', endsAt: '24:00', kind: 'per_hour', upToMinutes: null, amountMinor: centsPerHour, currency: 'USD' }],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length, records, invalidRows };
}
