// S4-2: Jersey City's Municipal Parking Lots, from its OpenDataSoft portal (specs/06, "Jersey City"; ADR-0012).
// Seven lots from 2020, with no hours, rates, or spaces; the app says so on each result (WEB-6).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { parseJson } from './arcgis.ts';
import { inCoverageArea } from './nj.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

const PORTAL = 'https://data.jerseycitynj.gov';
const DATASET = 'municipal-parking-lots';
export const JC_LOTS_URL = `${PORTAL}/api/explore/v2.1/catalog/datasets/${DATASET}/records?limit=100`;

/** The city's Parking page, which has the Parking Division's phone number. Checked on 2026-11-04. */
export const JC_PARKING_PAGE = 'https://www.jerseycitynj.gov/cityhall/public_safety/Parking';

export const jcMunicipalLots: SourceDefinition = {
  id: 'jc-municipal-lots',
  publisher: 'City of Jersey City',
  title: 'Municipal Parking Lots',
  datasetUrl: `${PORTAL}/explore/dataset/${DATASET}/`,
  termsUrl: `${PORTAL}/terms/terms-and-conditions/`,
  creditText: null,
  modificationCodes: ['merged_across_sources'],
  // Last changed in 2020. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '50 5 * * 3',
  fetch: fetchJcLots,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'jc-municipal-lots', normalizeJcLots(snapshot.body), snapshot.fetchedAt),
};

async function fetchJcLots(http: UpstreamHttp): Promise<FetchedData> {
  const rows = await http.get(JC_LOTS_URL);
  const parsed = parseJson(rows.body);
  if (!Array.isArray(parsed.results)) {
    throw new IngestionError('normalize.unexpected_format', 'response has no results');
  }
  if (typeof parsed.total_count === 'number' && parsed.total_count > parsed.results.length) {
    throw new IngestionError('upstream.too_large', `${DATASET} has more records than one request returns`);
  }
  const metadata = parseJson((await http.get(`${PORTAL}/api/explore/v2.1/catalog/datasets/${DATASET}`)).body);
  const modified = (metadata.metas as { default?: { modified?: unknown } } | undefined)?.default?.modified;
  const updatedAt = typeof modified === 'string' ? new Date(modified) : null;
  return { body: rows.body, contentType: rows.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

export function normalizeJcLots(body: Uint8Array): Normalized {
  const results = parseJson(body).results;
  if (!Array.isArray(results)) throw new IngestionError('normalize.unexpected_format', 'response has no results');
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;

  for (const row of results as Record<string, unknown>[]) {
    const name = typeof row.lots === 'string' ? row.lots.trim() : '';
    const address = typeof row.address === 'string' && row.address.trim() ? row.address.trim() : null;
    const { lat, lon } = (row.geopoints ?? {}) as { lat?: unknown; lon?: unknown };
    if (!name || typeof lat !== 'number' || typeof lon !== 'number' || !inCoverageArea({ lat, lng: lon })) {
      invalidRows += 1;
      continue;
    }
    records.push({
      recordId: name,
      facilityKey: `jc-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
      priority: 1,
      name,
      matchTokens: matchTokens(name),
      kind: 'lot',
      operatorName: 'City of Jersey City',
      operatorType: 'municipal',
      addressLine: address,
      locality: 'Jersey City',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat,
      lng: lon,
      spaces: null,
      officialUrl: JC_PARKING_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: results.length, records, invalidRows };
}

