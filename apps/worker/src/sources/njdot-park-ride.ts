// S2-5: NJDOT's park-and-ride lots (specs/06-sources.md, "New Jersey adapters"). Matched with NJ Transit's
// lots by distance (ING-12, cluster.ts), and NJ Transit's record is the primary.
import type { TransactionSql } from '@parking/db';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import { facilityKey, matchTokens, titleCase } from '../normalize/names.ts';
import { arcgisItemPage, attributeNumber, attributeText, fetchArcgisLayer, parseFeatures, type ArcgisLayerQuery } from './arcgis.ts';
import { inCoverageArea, NJDOT_PARK_RIDE_PAGE } from './nj.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { SourceDefinition, StoredSnapshot } from './types.ts';

export const NJDOT_ITEM_ID = 'ab33be6e4a51439c9ed179809b4d99cf';

export const NJDOT_QUERY: ArcgisLayerQuery = {
  itemId: NJDOT_ITEM_ID,
  // Not the contact fields (pr_Contact, pr_Contact_Email).
  outFields: ['OBJECTID', 'pr_Name', 'Municipality', 'County', 'pr_Capacity'],
  orderBy: 'OBJECTID',
  geometry: 'point',
};

export const njdotParkRide: SourceDefinition = {
  id: 'njdot-park-ride',
  publisher: 'New Jersey Department of Transportation (NJDOT)',
  title: 'New_Jersey_DOT_Park_Ride',
  datasetUrl: arcgisItemPage(NJDOT_ITEM_ID),
  // The item's terms field has only a liability disclaimer (SRC-3). It's admitted under ADR-0011 once we've asked (S2-10).
  termsUrl: arcgisItemPage(NJDOT_ITEM_ID),
  creditText: null,
  modificationCodes: ['duplicates_removed', 'municipalities_reformatted', 'merged_across_sources'],
  // Last edited in 2024. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '40 5 * * 2',
  fetch: (http) => fetchArcgisLayer(http, NJDOT_QUERY),
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'njdot-park-ride', normalizeNjdot(snapshot.body), snapshot.fetchedAt),
};

const NJDOT = 'New Jersey Department of Transportation';

export function normalizeNjdot(body: Uint8Array): Normalized {
  const features = parseFeatures(body);
  const records: SourceRecordInput[] = [];
  const names = new Set<string>();
  let invalidRows = 0;

  // In OBJECTID order (the query's order), so the lower OBJECTID of two lots with one name is kept.
  const ordered = [...features].sort((a, b) => (attributeNumber(a.attributes, 'OBJECTID') ?? 0) - (attributeNumber(b.attributes, 'OBJECTID') ?? 0));
  for (const { attributes, point } of ordered) {
    const objectId = attributeNumber(attributes, 'OBJECTID');
    const name = attributeText(attributes, 'pr_Name');
    const municipality = attributeText(attributes, 'Municipality');
    const tokens = name ? matchTokens(name) : [];
    if (objectId === null || !name || !municipality || tokens.length === 0 || !point || !inCoverageArea(point)) {
      invalidRows += 1;
      continue;
    }
    // A lot listed twice under one name is one lot (specs/06), not an error.
    if (names.has(name.toLowerCase())) continue;
    names.add(name.toLowerCase());

    const spaces = attributeNumber(attributes, 'pr_Capacity');
    records.push({
      recordId: String(objectId),
      facilityKey: facilityKey('njdot', tokens),
      priority: 2,
      name,
      matchTokens: tokens,
      kind: 'lot',
      operatorName: NJDOT,
      operatorType: 'state',
      addressLine: null,
      locality: titleCase(municipality),
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: point.lat,
      lng: point.lng,
      spaces: spaces !== null && spaces >= 0 ? spaces : null,
      officialUrl: NJDOT_PARK_RIDE_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: features.length, records, invalidRows };
}
