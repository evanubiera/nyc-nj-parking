// S4-27: South Orange's metered municipal lots, from the Village's "Meters & Pay Stations" page, kept by the South
// Orange Parking Authority (specs/06, "South Orange"). "Meters by Lots" gives each lot's meters: a time limit and an
// hourly rate. Some lots have two kinds of meter, listed as two entries ("Riverside" and "Riverside Lot 6"); they're
// one lot here. The page has no coordinates, so each lot was placed once on its tax parcel (LOTS). The site states
// no terms beyond a copyright notice; admitted without asking first (ADR-0014).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { FacilityKind, Normalized, RateInput, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import type { MeterPeriod } from '../normalize/meter-hours.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const SOUTH_ORANGE_METERS_PAGE = 'https://www.southorange.org/189/Meters-Pay-Stations';

export const southOrangeParkingLots: SourceDefinition = {
  id: 'south-orange-parking-lots',
  publisher: 'South Orange Parking Authority',
  title: 'Meters & Pay Stations: Meters by Lots',
  datasetUrl: SOUTH_ORANGE_METERS_PAGE,
  // The site's copyright notice is all it states (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: 'https://www.southorange.org/site/copyright',
  creditText: null,
  modificationCodes: ['locations_from_records', 'merged_across_sources'],
  schedule: '40 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'south-orange-parking-lots', normalizeSouthOrange(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(SOUTH_ORANGE_METERS_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

interface Lot {
  name: string;
  kind: FacilityKind;
  lat: number;
  lng: number;
  basis: string;
}

/** Each lot, placed on 2026-11-07 on its tax parcel, and the page's entries that are its meters. */
export const LOTS: Record<string, Lot> = {
  'taylor-place-garage': { name: 'Taylor Place Garage', kind: 'garage', lat: 40.74674, lng: -74.25848,
    basis: 'parcel 0719_1006_1, 52 Taylor Place, the apartment building whose garage this is (class 15F, payment in lieu of taxes)' },
  'library-lot-2': { name: 'Library Lot 2', kind: 'lot', lat: 40.74712, lng: -74.25772, basis: 'parcel 0719_1005_2, 57 Taylor Place, "parking lot"' },
  'village-hall-lot-4': { name: 'Village Hall Lot 4', kind: 'lot', lat: 40.74619, lng: -74.25693, basis: 'parcel 0719_1007_26, 20 Scotland Road, "village hall pkg lot"' },
  'riverside-lot-6': { name: 'Riverside Lot 6', kind: 'lot', lat: 40.7473, lng: -74.26175,
    basis: 'parcel 0719_1904_15, 105 South Orange Avenue West, "parking lot" (class 15A), the only public lot on West South Orange Avenue' },
  'irvington-avenue-lot-8': { name: 'Irvington Avenue Lot 8', kind: 'lot', lat: 40.74058, lng: -74.25337, basis: 'parcel 0719_2106_13, 296 Irvington Avenue, "parking lot"' },
};

/** The page's entries, by the name before " – (…)", and the lot each belongs to. */
export const ENTRIES: Record<string, keyof typeof LOTS> = {
  'Taylor Place Garage': 'taylor-place-garage',
  'Library Lot 2': 'library-lot-2',
  Scotland: 'village-hall-lot-4',
  'Village Hall Lot 4': 'village-hall-lot-4',
  Riverside: 'riverside-lot-6',
  'Riverside Lot 6': 'riverside-lot-6',
  'Irvington Avenue': 'irvington-avenue-lot-8',
  'Irvington Avenue Lot 8': 'irvington-avenue-lot-8',
};

const WORD_HOURS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, twelve: 12 };

export interface MeterEntry {
  name: string;
  where: string;
  maxStayHours: number;
  centsPerHour: number;
}

/** "Meters by Lots": "Name – (where)", "Time: 3 Hour Limit", "Rate: $1.00 per Hour". A change fails the run (ING-3). */
export function meterEntries(text: string): MeterEntry[] {
  // The enforcement rule for every meter: Monday to Saturday, 8am to 6pm, and 6am to 6pm for 12-hour meters.
  if (!/enforced Monday - Saturday, 8am - 6pm, except the 12 hour meters, which are enforced from 6am- 6pm/.test(text)) {
    throw new IngestionError('normalize.unexpected_format', 'the enforcement hours changed');
  }
  const start = text.indexOf('\nMeters by Lots\nMeters are enforced');
  const end = text.indexOf('\nMeters by Streets\nMeters are', start);
  if (start < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no "Meters by Lots" section');
  const lines = text.slice(start, end).split('\n');
  const entries: MeterEntry[] = [];
  lines.forEach((line, index) => {
    const head = /^(.+?)\s*[-–]\s*\((.+)\)$/.exec(line);
    if (!head) return;
    const time = /^Time: (\w+) Hour Limit$/.exec(lines[index + 1] ?? '');
    const rate = /^Rate: (?:\$(\d+)\.(\d{2})|(\d+)¢) per Hour$/.exec(lines[index + 2] ?? '');
    const hours = time ? (Number(time[1]) || WORD_HOURS[time[1]!.toLowerCase()]) : undefined;
    if (!hours || !rate) throw new IngestionError('normalize.unexpected_format', `the wording for ${head[1]} changed`);
    const cents = rate[3] !== undefined ? Number(rate[3]) : Number(rate[1]) * 100 + Number(rate[2]);
    entries.push({ name: head[1]!.trim(), where: head[2]!.trim(), maxStayHours: hours, centsPerHour: cents });
  });
  return entries;
}

export function normalizeSouthOrange(body: Uint8Array): Normalized {
  const entries = meterEntries(pageText(body));
  const byLot = new Map<string, MeterEntry[]>();
  let invalidRows = 0;
  for (const entry of entries) {
    const key = ENTRIES[entry.name];
    if (!key) {
      invalidRows += 1;
      continue;
    }
    byLot.set(key, [...(byLot.get(key) ?? []), entry]);
  }
  const records: SourceRecordInput[] = [...byLot.entries()].map(([key, meters]) => {
    const lot = LOTS[key]!;
    // The lot's own entry ("Riverside Lot 6 – (West South Orange Avenue)") gives the fullest "where".
    const where = (meters.find((meter) => meter.name === lot.name) ?? meters[0]!).where;
    const periods: MeterPeriod[] = meters.map((meter) => ({
      days: 63,
      startsAt: meter.maxStayHours === 12 ? '06:00' : '08:00',
      endsAt: '18:00',
      maxStayMinutes: meter.maxStayHours * 60,
      vehicleClass: null,
      sourceText: `${meter.name}: ${meter.maxStayHours} hour limit, ${meter.centsPerHour}¢ per hour`,
    }));
    const rates: RateInput[] = meters.map((meter, index) => ({
      days: 63, startsAt: periods[index]!.startsAt, endsAt: '18:00', kind: 'per_hour', upToMinutes: null, amountMinor: meter.centsPerHour, currency: 'USD',
    }));
    return {
      recordId: key,
      facilityKey: `south-orange-${key}`,
      priority: 1,
      name: lot.name,
      matchTokens: matchTokens(lot.name),
      kind: lot.kind,
      // A town's own parking authority runs the town's lots: city-run (specs/03).
      operatorName: 'South Orange Parking Authority',
      operatorType: 'municipal',
      addressLine: where,
      locality: 'South Orange',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: lot.lat,
      lng: lot.lng,
      spaces: null,
      officialUrl: SOUTH_ORANGE_METERS_PAGE,
      meterPeriods: periods,
      rates,
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    };
  });
  return { rowsRead: entries.length, records, invalidRows };
}
