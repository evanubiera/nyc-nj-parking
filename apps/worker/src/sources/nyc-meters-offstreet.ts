// S1-4: DOT's meters inside municipal parking fields (specs/06-sources.md). One record per field: the
// active meters grouped by field name, located at their average position, with their metered hours.
import type { TransactionSql } from '@parking/db';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import { parseMeterHours, type MeterPeriod } from '../normalize/meter-hours.ts';
import { facilityKey, matchTokens } from '../normalize/names.ts';
import { boroughName, dotFacilitiesUrl, inNewYorkCity, NEW_YORK_TIME, NYC_DOT, NYC_DOT_PREFIX, NYC_OPEN_DATA, NYC_OPEN_DATA_TERMS } from './nyc.ts';
import { fetchSocrata, number, parseRows, text, type SocrataQuery } from './socrata.ts';
import type { SourceDefinition, StoredSnapshot } from './types.ts';

export const METERS_QUERY: SocrataQuery = {
  domain: NYC_OPEN_DATA,
  datasetId: '693u-uax6',
  params: {
    $select: 'meter_number,status,meter_hours,parking_facility_name,facility,borough,on_street,lat,long',
    $where: "upper(facility)='OFF STREET'",
    $order: 'meter_number',
  },
};

export const nycMetersOffstreet: SourceDefinition = {
  id: 'nyc-meters-offstreet',
  publisher: 'Department of Transportation (DOT)',
  title: 'Parking Meters Locations and Status',
  datasetUrl: 'https://data.cityofnewyork.us/d/693u-uax6',
  termsUrl: NYC_OPEN_DATA_TERMS,
  creditText: null,
  modificationCodes: ['meter_hours_parsed', 'inactive_meters_excluded', 'location_from_meters', 'names_reformatted', 'merged_across_sources'],
  // The source updates weekly; a daily check costs two requests and skips unchanged data (ING-7).
  schedule: '45 4 * * *',
  fetch: (http) => fetchSocrata(http, METERS_QUERY),
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'nyc-meters-offstreet', normalizeMeters(snapshot.body), snapshot.fetchedAt),
};

interface Meter {
  name: string;
  borough: string;
  lat: number;
  lng: number;
  hours: string | null;
}

export function normalizeMeters(body: Uint8Array): Normalized {
  const rows = parseRows(body);
  const groups = new Map<string, Meter[]>();
  let invalidRows = 0;

  for (const row of rows) {
    // Inactive meters and meters with no field name aren't errors; they just don't describe a field.
    if (text(row, 'status')?.toLowerCase() !== 'active') continue;
    const name = text(row, 'parking_facility_name');
    if (!name) continue;
    const borough = boroughName(text(row, 'borough'));
    const lat = number(row, 'lat');
    const lng = number(row, 'long');
    const tokens = matchTokens(name);
    if (!borough || lat === null || lng === null || !inNewYorkCity(lat, lng) || tokens.length === 0) {
      invalidRows += 1;
      continue;
    }
    const key = tokens.join('-');
    groups.set(key, [...(groups.get(key) ?? []), { name, borough, lat, lng, hours: text(row, 'meter_hours') }]);
  }

  const records = [...groups.entries()].map(([key, meters]) => meterGroupRecord(key, meters));
  return { rowsRead: rows.length, records, invalidRows };
}

function meterGroupRecord(key: string, meters: Meter[]): SourceRecordInput {
  const first = meters[0]!;
  const borough = mostCommon(meters.map((meter) => meter.borough));
  return {
    recordId: key,
    facilityKey: facilityKey(NYC_DOT_PREFIX, key.split('-')),
    priority: 2,
    name: meterFieldName(first.name),
    matchTokens: key.split('-'),
    kind: 'field',
    // The dataset is DOT's meters in DOT's municipal parking fields; it has no operator column.
    operatorName: NYC_DOT,
    operatorType: 'municipal',
    addressLine: null,
    locality: borough,
    region: 'NY',
    timeZone: NEW_YORK_TIME,
    lat: average(meters.map((meter) => meter.lat)),
    lng: average(meters.map((meter) => meter.lng)),
    spaces: null,
    officialUrl: dotFacilitiesUrl(borough),
    meterPeriods: meterPeriods(meters),
  };
}

/** "Meeker Avenue Parking Field" or "Rosedale" → "… Municipal Parking Field", as DOT names them. */
export function meterFieldName(name: string): string {
  const base = name.replace(/\s*(municipal\s+)?parking\s+field\s*$/i, '').trim();
  return `${base} Municipal Parking Field`;
}

/** Every distinct period from the group's meters. Text that doesn't parse adds nothing (specs/03). */
function meterPeriods(meters: Meter[]): MeterPeriod[] {
  const texts = [...new Set(meters.map((meter) => meter.hours).filter((hours): hours is string => hours !== null))].sort();
  return texts.flatMap((hours) => parseMeterHours(hours) ?? []);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]![0];
}
