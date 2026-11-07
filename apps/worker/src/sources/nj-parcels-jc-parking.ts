// S4-3: unconfirmed parking sites in Jersey City, from the State's parcel and tax-record layer (ADR-0012,
// specs/06 "Jersey City"). A site is public land (class 15C) that the assessor describes as parking. The layer
// doesn't say who owns it (owner names are redacted) or whether the public may park there, so every site is
// marked unconfirmed, with operator type `unknown` and no official page (REC-9).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { metersBetween } from '../facilities/cluster.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { titleCase } from '../normalize/names.ts';
import { arcgisItemPage, parseJson, queryArcgisLayer, resolveArcgisLayer } from './arcgis.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const NJ_PARCELS_ITEM_ID = '533599bbfbaa4748bf39faf1375a8a9c';
const JERSEY_CITY = '0906';

export const CANDIDATES_WHERE = `PCL_MUN='${JERSEY_CITY}' AND PROP_CLASS='15C' AND (BLDG_DESC LIKE '%PARKING%' OR FAC_NAME LIKE '%PARKING%')`;
const CANDIDATE_FIELDS = 'PAMS_PIN,PCLBLOCK,PCLLOT,PROP_LOC,BLDG_DESC,FAC_NAME';
const NEIGHBOUR_FIELDS = 'PAMS_PIN,PCLBLOCK,PROP_CLASS,BLDG_DESC,FAC_NAME';

export const njParcelsJcParking: SourceDefinition = {
  id: 'nj-parcels-jc-parking',
  publisher: 'NJ Office of Information Technology, Office of GIS (NJOGIS)',
  title: 'Parcels and MOD-IV Composite of NJ',
  datasetUrl: arcgisItemPage(NJ_PARCELS_ITEM_ID),
  // The item's terms: a disclaimer, not survey data, credit to NJOGIS requested, and the State's Conditions of Use.
  termsUrl: arcgisItemPage(NJ_PARCELS_ITEM_ID),
  creditText: null,
  modificationCodes: ['sites_from_parcels', 'unconfirmed_public_use', 'merged_across_sources'],
  // Published every few months. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '55 5 * * 3',
  fetch: fetchCandidates,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'nj-parcels-jc-parking', normalizeCandidates(snapshot.body), snapshot.fetchedAt),
};

/** Two queries: the candidate parcels, then the other public parcels on their blocks. Stored together (specs/03). */
async function fetchCandidates(http: UpstreamHttp): Promise<FetchedData> {
  const { layerUrl, editedAt } = await resolveArcgisLayer(http, NJ_PARCELS_ITEM_ID);
  const candidates = await queryArcgisLayer(http, layerUrl, {
    where: CANDIDATES_WHERE,
    outFields: CANDIDATE_FIELDS,
    orderByFields: 'PAMS_PIN',
    returnGeometry: 'true',
    returnCentroid: 'true',
  });
  const blocks = [...new Set(features(candidates.body).map((feature) => text(feature.attributes, 'PCLBLOCK')).filter(Boolean))].sort();
  if (blocks.length === 0) throw new IngestionError('normalize.empty', 'no candidate parcels');
  const neighbours = await queryArcgisLayer(http, layerUrl, {
    where: `PCL_MUN='${JERSEY_CITY}' AND PROP_CLASS LIKE '15%' AND PCLBLOCK IN (${blocks.map((block) => `'${block.replace(/'/g, '')}'`).join(',')})`,
    outFields: NEIGHBOUR_FIELDS,
    orderByFields: 'PAMS_PIN',
    returnGeometry: 'false',
  });
  const decode = (body: Uint8Array) => new TextDecoder().decode(body);
  const body = new TextEncoder().encode(JSON.stringify({ candidates: decode(candidates.body), neighbours: decode(neighbours.body) }));
  return { body, contentType: 'application/json', upstreamUpdatedAt: editedAt };
}

interface Parcel {
  pin: string;
  block: string;
  lot: string;
  location: string;
  description: string;
  point: { lat: number; lng: number };
  corners: { lat: number; lng: number }[];
}

/** Railroad or right-of-way land isn't a parking lot (ING-13). */
const RIGHT_OF_WAY = /R\.?O\.?W|RAILROAD|RIGHT OF WAY/i;
/** Another public use on the block that the parking most likely serves (ING-13). */
const SERVES = /SCHOOL|COLLEGE|POLICE|FIRE|HOUSING|POST|COURT|LIBRARY|HOSPITAL|ADMIN|OFFICE|COMMUNITY|\bGARAGES?\b|\bPARKS?\b|RECREATION|CHURCH|CEMET/i;

export function normalizeCandidates(body: Uint8Array): Normalized {
  const envelope = parseJson(body);
  if (typeof envelope.candidates !== 'string' || typeof envelope.neighbours !== 'string') {
    throw new IngestionError('normalize.unexpected_format', 'snapshot is missing a query response');
  }
  const candidateFeatures = features(envelope.candidates);
  const parcels: Parcel[] = [];
  let invalidRows = 0;
  for (const feature of candidateFeatures) {
    const parcel = readParcel(feature);
    if (parcel) parcels.push(parcel);
    else invalidRows += 1;
  }

  // Every public parcel's description on the block, the candidates' own included: a parcel recorded as
  // "parking lot" with facility "post office" is the post office's lot. "Parking garage" isn't another use.
  const blockUses = new Map<string, string[]>();
  for (const { attributes } of features(envelope.neighbours)) {
    const description = `${text(attributes, 'BLDG_DESC')} ${text(attributes, 'FAC_NAME')}`.replace(/PARKING GARAGES?/gi, '');
    const block = text(attributes, 'PCLBLOCK');
    blockUses.set(block, [...(blockUses.get(block) ?? []), description]);
  }

  const records: SourceRecordInput[] = [];
  for (const site of sitesOf(parcels)) {
    if (site.some((parcel) => RIGHT_OF_WAY.test(parcel.description))) continue;
    const uses = [...(blockUses.get(site[0]!.block) ?? []), ...site.map((parcel) => parcel.description.replace(/PARKING GARAGES?/gi, ''))];
    if (uses.some((use) => SERVES.test(use))) continue;
    records.push(toRecord(site));
  }
  return { rowsRead: candidateFeatures.length, records, invalidRows };
}

/** Candidate parcels on one block whose outlines touch, joined transitively (specs/06). */
function sitesOf(parcels: Parcel[]): Parcel[][] {
  const touch = (a: Parcel, b: Parcel) =>
    metersBetween(a.point, b.point) <= 600 && a.corners.some((u) => b.corners.some((v) => metersBetween(u, v) <= 1.5));
  const sites: Parcel[][] = [];
  const byBlock = new Map<string, Parcel[]>();
  for (const parcel of [...parcels].sort((a, b) => (a.pin < b.pin ? -1 : 1))) {
    byBlock.set(parcel.block, [...(byBlock.get(parcel.block) ?? []), parcel]);
  }
  for (const group of byBlock.values()) {
    const left = [...group];
    while (left.length > 0) {
      const site = [left.shift()!];
      for (let grew = true; grew; ) {
        grew = false;
        for (const parcel of [...left]) {
          if (site.some((member) => touch(parcel, member))) {
            site.push(parcel);
            left.splice(left.indexOf(parcel), 1);
            grew = true;
          }
        }
      }
      sites.push(site);
    }
  }
  return sites;
}

function toRecord(site: Parcel[]): SourceRecordInput {
  const first = site[0]!; // the lowest PAMS_PIN
  return {
    recordId: first.pin,
    facilityKey: `jc-site-${`${first.block}-${first.lot}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
    priority: 3,
    name: titleCase(first.location),
    // Never matched by name: an address isn't a lot's name. Only by distance (ING-14).
    matchTokens: [],
    kind: 'lot',
    operatorName: null,
    operatorType: 'unknown',
    addressLine: null,
    locality: 'Jersey City',
    region: 'NJ',
    timeZone: NEW_YORK_TIME,
    lat: site.reduce((sum, parcel) => sum + parcel.point.lat, 0) / site.length,
    lng: site.reduce((sum, parcel) => sum + parcel.point.lng, 0) / site.length,
    spaces: null,
    officialUrl: null,
    meterPeriods: [],
    rates: [],
    confirmed: false,
    lotNumber: null,
    withheldReason: null,
  };
}

function readParcel({ attributes, centroid, geometry }: RawFeature): Parcel | null {
  const pin = text(attributes, 'PAMS_PIN');
  const block = text(attributes, 'PCLBLOCK');
  const location = text(attributes, 'PROP_LOC');
  const { x, y } = (centroid ?? {}) as { x?: unknown; y?: unknown };
  if (!pin || !block || !location || typeof x !== 'number' || typeof y !== 'number') return null;
  const rings = ((geometry ?? {}) as { rings?: unknown }).rings;
  const corners = Array.isArray(rings)
    ? rings.flatMap((ring) => (Array.isArray(ring) ? ring : [])).flatMap((point) =>
        Array.isArray(point) && typeof point[0] === 'number' && typeof point[1] === 'number' ? [{ lat: point[1], lng: point[0] }] : [])
    : [];
  return {
    pin,
    block,
    lot: text(attributes, 'PCLLOT'),
    location: location.replace(/\s+/g, ' '),
    description: `${text(attributes, 'BLDG_DESC')} ${text(attributes, 'FAC_NAME')}`,
    point: { lat: y, lng: x },
    corners,
  };
}

interface RawFeature {
  attributes: Record<string, unknown>;
  centroid?: unknown;
  geometry?: unknown;
}

function features(body: Uint8Array | string): RawFeature[] {
  const list = parseJson(body).features;
  if (!Array.isArray(list)) throw new IngestionError('normalize.unexpected_format', 'response has no features');
  return list.filter((feature): feature is RawFeature => typeof (feature as RawFeature)?.attributes === 'object' && (feature as RawFeature).attributes !== null);
}

function text(attributes: Record<string, unknown>, field: string): string {
  const value = attributes[field];
  return typeof value === 'string' ? value.trim() : '';
}
