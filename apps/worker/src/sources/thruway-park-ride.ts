// S5-2: the New York State Thruway Authority's commuter park-and-ride lots, from data.ny.gov (specs/06, "New York
// State"). 31 lots along the Thruway, each with its exit, who runs it, and its spaces. The one run by a shopping centre
// (the Palisades Center's Lot J) is private and left out (ADR-0007). Under the OPEN-NY Terms of Use, which ask for no
// attribution and allow reuse (ADR-0022).
import type { TransactionSql } from '@parking/db';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, OperatorType, SourceRecordInput } from '../facilities/types.ts';
import { facilityKey, matchTokens } from '../normalize/names.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import { inNewYorkState, NY_OPEN_DATA, OPEN_NY_TERMS } from './nys.ts';
import { fetchSocrata, number, parseRows, text, type SocrataQuery } from './socrata.ts';
import type { SourceDefinition, StoredSnapshot } from './types.ts';

/** The Thruway's own page for its commuter lots (checked 2026-11-11). The dataset's link to it is out of date. */
export const THRUWAY_PARK_RIDE_PAGE = 'https://thruway.ny.gov/travelers/commuter-park-ride';

export const THRUWAY_QUERY: SocrataQuery = {
  domain: NY_OPEN_DATA,
  datasetId: 'nvxe-b625',
  params: { $select: 'title,exit,run_by,spaces,comments,latitude,longitude', $order: 'exit,title' },
};

export const thruwayParkRide: SourceDefinition = {
  id: 'nys-thruway-park-ride',
  publisher: 'New York State Thruway Authority',
  title: 'Thruway Commuter Park and Ride Lots',
  datasetUrl: 'https://data.ny.gov/d/nvxe-b625',
  termsUrl: OPEN_NY_TERMS,
  creditText: null,
  modificationCodes: ['private_or_unowned_excluded'],
  // Updated as needed (last 2024-12-12). A weekly check is plenty; unchanged data is skipped (ING-7).
  schedule: '20 6 * * 5',
  fetch: (http) => fetchSocrata(http, THRUWAY_QUERY),
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'nys-thruway-park-ride', normalizeThruway(snapshot.body), snapshot.fetchedAt),
};

/** Who runs each lot, as the dataset writes it (ADR-0007). A value that isn't here makes the row unreadable (ING-10). */
const RUN_BY: Record<string, { name: string; type: OperatorType } | 'private'> = {
  'NYS Thruway Authority': { name: 'New York State Thruway Authority', type: 'public_authority' },
  'NYS Department of Transportation': { name: 'New York State Department of Transportation', type: 'state' },
  'NYS Department of Transportation and Town of Clarkstown': { name: 'New York State Department of Transportation and Town of Clarkstown', type: 'state' },
  'Niagara Frontier Transportation Authority': { name: 'Niagara Frontier Transportation Authority', type: 'transit_agency' },
  'Palisades Center': 'private',
};

export function normalizeThruway(body: Uint8Array): Normalized {
  const rows = parseRows(body);
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const row of rows) {
    const title = text(row, 'title');
    const runBy = RUN_BY[text(row, 'run_by') ?? ''];
    const lat = number(row, 'latitude');
    const lng = number(row, 'longitude');
    if (!title || !runBy || lat === null || lng === null || !inNewYorkState({ lat, lng })) {
      invalidRows += 1;
      continue;
    }
    if (runBy === 'private') continue; // modification `private_or_unowned_excluded`
    const tokens = matchTokens(title);
    const comments = text(row, 'comments');
    records.push({
      recordId: `${text(row, 'exit') ?? ''}/${title}`,
      facilityKey: facilityKey('nysta', tokens),
      priority: 2,
      name: title,
      matchTokens: tokens,
      kind: 'lot',
      operatorName: runBy.name,
      operatorType: runBy.type,
      // "Located on Rt. 17K at Union Avenue …" says where it is; "16-hour Parking Limit" doesn't. A note's sentences end
      // with two spaces or " ("; "Rt. 59" doesn't end one.
      addressLine: comments && /^Located /.test(comments) ? comments.replace(/^Located /, '').replace(/^./, (letter) => letter.toUpperCase()).replace(/\.(?:\s{2,}|\s+\().*$/, '').replace(/\.$/, '') : null,
      // The lot's place, as its title names it: "Spring Valley (East Lot)" is in Spring Valley.
      locality: title.replace(/\s*\(.*\)$/, ''),
      region: 'NY',
      timeZone: NEW_YORK_TIME,
      lat,
      lng,
      spaces: number(row, 'spaces'),
      officialUrl: THRUWAY_PARK_RIDE_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: rows.length, records, invalidRows };
}
