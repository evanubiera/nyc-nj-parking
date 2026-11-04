// S2-4: NJ Transit's Parking Lot Database (specs/06-sources.md, "New Jersey adapters"). The rules for
// owners, exclusions, and lot numbers were decided with the user on 2026-11-03 (PRD-4, ADR-0007).
import type { TransactionSql } from '@parking/db';
import { applyNormalized } from '../facilities/apply.ts';
import type { FacilityKind, Normalized, OperatorType, SourceRecordInput, WithheldReason } from '../facilities/types.ts';
import { facilityKey, matchTokens } from '../normalize/names.ts';
import { arcgisItemPage, attributeNumber, attributeText, fetchArcgisLayer, parseFeatures, type ArcgisLayerQuery, type Feature } from './arcgis.ts';
import { inCoverageArea, NJT_PARKING_PAGE } from './nj.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { SourceDefinition, StoredSnapshot } from './types.ts';

export const NJT_ITEM_ID = '2f311895a644453f8f679479187aa19e';

export const NJT_QUERY: ArcgisLayerQuery = {
  itemId: NJT_ITEM_ID,
  // Not the contact fields (contacname, pubcontact, contaccomp): they name people and phone numbers.
  outFields: ['objectid', 'facilityid', 'name', 'lot_number', 'lotuse', 'municipality', 'county', 'location', 'lotowner', 'totalspaces', 'active', 'conwebsite'],
  orderBy: 'objectid',
  geometry: 'centroid',
};

export const njtParkingLots: SourceDefinition = {
  id: 'njt-parking-lots',
  publisher: 'NJ Transit',
  title: 'Parking Lot Database View',
  datasetUrl: arcgisItemPage(NJT_ITEM_ID),
  // The item states no terms (SRC-2). It's admitted under ADR-0011 once we've asked (S2-10).
  termsUrl: arcgisItemPage(NJT_ITEM_ID),
  creditText: null,
  modificationCodes: ['location_from_outline', 'private_or_unowned_excluded', 'lot_numbers_reformatted', 'merged_across_sources'],
  // The layer is edited every few weeks; ADR-0011 allows at most one fetch a day, and unchanged data is skipped (ING-7).
  schedule: '30 5 * * *',
  fetch: (http) => fetchArcgisLayer(http, NJT_QUERY),
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'njt-parking-lots', normalizeNjt(snapshot.body), snapshot.fetchedAt),
};

const NJ_TRANSIT = { name: 'NJ Transit', type: 'transit_agency' } as const;

/** ADR-0007 and PRD-4, decided 2026-11-03. An owner that isn't here makes the row unreadable (ING-10). */
const OWNERS: Record<string, ((row: Row) => { name: string; type: OperatorType }) | 'private'> = {
  Municipality: (row) => ({ name: row.municipality, type: 'municipal' }),
  'NJ Transit': () => NJ_TRANSIT,
  'NJ TRANSIT/Municipality': () => NJ_TRANSIT,
  'NJ Transit/Kean University': () => NJ_TRANSIT,
  PATCO: () => ({ name: 'PATCO', type: 'transit_agency' }),
  NJTA: () => ({ name: 'New Jersey Turnpike Authority', type: 'public_authority' }),
  'NJ Turnpike': () => ({ name: 'New Jersey Turnpike Authority', type: 'public_authority' }),
  PANYNJ: () => ({ name: 'Port Authority of New York and New Jersey', type: 'public_authority' }),
  NJDOT: () => ({ name: 'New Jersey Department of Transportation', type: 'state' }),
  County: (row) => ({ name: `${countyName(row.county)} County`, type: 'county' }),
  Private: 'private',
  'Avalon Bay': 'private',
  'NJ Transit/Private': 'private',
  'Municipal/Private': 'private',
};

interface Row {
  facilityId: string;
  name: string;
  lotNumber: string | null;
  lotUse: string;
  municipality: string;
  county: string | null;
  owner: string;
  point: { lat: number; lng: number };
  attributes: Record<string, unknown>;
}

export function normalizeNjt(body: Uint8Array): Normalized {
  const features = parseFeatures(body);
  const rows: Row[] = [];
  let invalidRows = 0;

  for (const feature of features) {
    const row = readRow(feature);
    if (row === 'excluded') continue;
    if (row === 'invalid') invalidRows += 1;
    else rows.push(row);
  }

  // REC-8: a lot number only where it tells lots with the same name apart.
  const sameName = new Map<string, number>();
  for (const row of rows) sameName.set(nameKey(row), (sameName.get(nameKey(row)) ?? 0) + 1);

  const records: SourceRecordInput[] = [];
  for (const row of rows) {
    const record = toRecord(row, (sameName.get(nameKey(row)) ?? 0) > 1);
    if (record) records.push(record);
    else invalidRows += 1;
  }
  return { rowsRead: features.length, records, invalidRows };
}

function readRow({ attributes, point }: Feature): Row | 'excluded' | 'invalid' {
  const lotUse = attributeText(attributes, 'lotuse');
  // Left out on purpose (specs/06): the test row, lots not in use, station entries with no parking,
  // and lots with no recorded owner (PRD-4).
  if (lotUse?.toLowerCase() === 'test') return 'excluded';
  if (attributeText(attributes, 'active') !== 'Active') return 'excluded';
  if (attributeNumber(attributes, 'totalspaces') === 0) return 'excluded';
  const owner = attributeText(attributes, 'lotowner');
  if (owner === null) return 'excluded';

  const facilityId = attributeText(attributes, 'facilityid');
  const name = attributeText(attributes, 'name');
  const municipality = attributeText(attributes, 'municipality');
  if (!facilityId || !name || !lotUse || !municipality || !point || !inCoverageArea(point) || !(owner in OWNERS)) {
    return 'invalid';
  }
  return {
    facilityId,
    name,
    lotNumber: attributeText(attributes, 'lot_number'),
    lotUse,
    municipality,
    county: attributeText(attributes, 'county'),
    owner,
    point,
    attributes,
  };
}

function toRecord(row: Row, numbered: boolean): SourceRecordInput | null {
  const tokens = matchTokens(row.name);
  const keyTokens = matchTokens(row.facilityId);
  if (tokens.length === 0 || keyTokens.length === 0 || (row.owner === 'County' && !row.county)) return null;
  const rule = OWNERS[row.owner]!;
  const withheldReason: WithheldReason | null = rule === 'private' ? 'private_owner' : null;
  // A withheld record is never shown, so its operator is only a stand-in.
  const operator = rule === 'private' ? NJ_TRANSIT : rule(row);
  const spaces = attributeNumber(row.attributes, 'totalspaces');

  return {
    recordId: `${slug(row.lotUse)}/${row.facilityId}`,
    facilityKey: facilityKey('njt', keyTokens),
    priority: 1,
    name: row.name,
    matchTokens: tokens,
    kind: kindOf(row.name),
    operatorName: operator.name,
    operatorType: operator.type,
    addressLine: attributeText(row.attributes, 'location'),
    locality: row.municipality,
    region: row.county && /\bNY\b/.test(row.county) ? 'NY' : 'NJ',
    timeZone: NEW_YORK_TIME,
    lat: row.point.lat,
    lng: row.point.lng,
    spaces: spaces !== null && spaces >= 0 ? spaces : null,
    officialUrl: officialUrl(attributeText(row.attributes, 'conwebsite')),
    meterPeriods: [],
    lotNumber: numbered && row.lotNumber ? row.lotNumber.replace(/^0+(?=\d)/, '') : null,
    withheldReason,
  };
}

function nameKey(row: Row): string {
  return `${row.lotUse.toLowerCase()}|${row.name.toLowerCase()}`;
}

/** "Rockland, NY" → "Rockland"; "Orange (NY)" → "Orange"; "Somerset" stays. */
export function countyName(county: string | null): string {
  return (county ?? '').replace(/\s*(,\s*NY|\(NY\))\s*$/, '').trim();
}

export function kindOf(name: string): FacilityKind {
  return /\b(garage|deck)\b/i.test(name) ? 'garage' : 'lot';
}

/** The lot's own site when its record gives one, other than NJ Transit's home page; otherwise NJ Transit's Parking page. */
export function officialUrl(website: string | null): string {
  if (!website || !/^https?:\/\//i.test(website)) return NJT_PARKING_PAGE;
  try {
    const url = new URL(website);
    const home = /^(www\.)?njtransit\.com$/i.test(url.hostname) && (url.pathname === '/' || url.pathname === '');
    return home ? NJT_PARKING_PAGE : url.toString();
  } catch {
    return NJT_PARKING_PAGE;
  }
}

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
