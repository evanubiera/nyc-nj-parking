// S1-3: DOT's public parking garages and fields, from the Facilities Database (specs/06-sources.md).
import type { TransactionSql } from '@parking/db';
import { applyNormalized } from '../facilities/apply.ts';
import type { FacilityKind, Normalized, SourceRecordInput } from '../facilities/types.ts';
import { facilityKey, matchTokens, titleCase } from '../normalize/names.ts';
import { boroughName, dotFacilitiesUrl, inNewYorkCity, NEW_YORK_TIME, NYC_DOT_PREFIX, NYC_OPEN_DATA, NYC_OPEN_DATA_TERMS } from './nyc.ts';
import { fetchSocrata, number, parseRows, text, type SocrataQuery } from './socrata.ts';
import type { SourceDefinition, StoredSnapshot } from './types.ts';

export const FACDB_QUERY: SocrataQuery = {
  domain: NYC_OPEN_DATA,
  datasetId: 'ji82-xba5',
  params: {
    $select: 'uid,facname,address,boro,latitude,longitude,opname,factype',
    $where: "datasource='dot_publicparking'",
    $order: 'uid',
  },
};

export const nycFacdbDot: SourceDefinition = {
  id: 'nyc-facdb-dot',
  publisher: 'Department of City Planning (DCP)',
  title: 'Facilities Database',
  datasetUrl: 'https://data.cityofnewyork.us/d/ji82-xba5',
  termsUrl: NYC_OPEN_DATA_TERMS,
  creditText: null,
  modificationCodes: ['names_reformatted', 'addresses_reformatted', 'merged_across_sources'],
  // The source changes about every 6 months; a weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '15 4 * * 1',
  fetch: (http) => fetchSocrata(http, FACDB_QUERY),
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'nyc-facdb-dot', normalizeFacdb(snapshot.body), snapshot.fetchedAt),
};

export function normalizeFacdb(body: Uint8Array): Normalized {
  const rows = parseRows(body);
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;

  for (const row of rows) {
    const record = facdbRecord(row);
    if (record) records.push(record);
    else invalidRows += 1;
  }
  return { rowsRead: rows.length, records, invalidRows };
}

function facdbRecord(row: Record<string, unknown>): SourceRecordInput | null {
  const uid = text(row, 'uid');
  const facname = text(row, 'facname');
  const operator = text(row, 'opname');
  const borough = boroughName(text(row, 'boro'));
  const lat = number(row, 'latitude');
  const lng = number(row, 'longitude');
  if (!uid || !facname || !operator || !borough || lat === null || lng === null || !inNewYorkCity(lat, lng)) {
    return null;
  }
  const tokens = matchTokens(facname);
  if (tokens.length === 0) return null;

  return {
    recordId: uid,
    facilityKey: facilityKey(NYC_DOT_PREFIX, tokens),
    priority: 1,
    name: facdbDisplayName(facname),
    matchTokens: tokens,
    kind: facdbKind(facname),
    operatorName: operator,
    operatorType: 'municipal',
    addressLine: facdbAddress(text(row, 'address')),
    locality: borough,
    region: 'NY',
    timeZone: NEW_YORK_TIME,
    lat,
    lng,
    spaces: null, // `capacity` is 0 on every DOT row (specs/06), so it isn't used.
    officialUrl: dotFacilitiesUrl(borough),
    meterPeriods: [],
  };
}

const SUFFIX: Record<string, string> = {
  FIELD: 'Municipal Parking Field',
  GARAGE: 'Municipal Parking Garage',
  'GARAGE/FIELD': 'Municipal Parking Garage',
};

/** "AVENUE M, FIELD" → "Avenue M Municipal Parking Field", matching how DOT names them on its page. */
export function facdbDisplayName(facname: string): string {
  const comma = facname.lastIndexOf(',');
  if (comma === -1) return titleCase(facname);
  const base = facname.slice(0, comma).trim();
  const suffix = facname.slice(comma + 1).trim().toUpperCase();
  return SUFFIX[suffix] ? `${titleCase(base)} ${SUFFIX[suffix]}` : titleCase(`${base} ${facname.slice(comma + 1).trim()}`);
}

export function facdbKind(facname: string): FacilityKind {
  return /GARAGE/i.test(facname) ? 'garage' : 'field';
}

/** "2602 EAST 17TH STREET, BROOKLYN, NY 11235" → "2602 East 17th Street". */
export function facdbAddress(address: string | null): string | null {
  if (!address) return null;
  const street = address.replace(/,\s*(BRONX|BROOKLYN|MANHATTAN|QUEENS|STATEN ISLAND)\s*,\s*NY\s*\d{5}\s*$/i, '').trim();
  return street ? titleCase(street) : null;
}
