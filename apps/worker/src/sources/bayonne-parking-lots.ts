// S4-18: Bayonne's municipal metered parking lots, from Ordinance O-16-64 on the City's own site (ADR-0016,
// specs/06 "Bayonne"). The ordinance sets each lot by street and by tax block and lot. It's a PDF, transcribed once by
// hand (LOTS), and each run checks the file is still the one transcribed (ING-15). The City states no terms; it's
// admitted without asking first (ADR-0014), and comes out if Bayonne objects.
import { createHash } from 'node:crypto';
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const BAYONNE_ORDINANCE = 'https://www.bayonnenj.org/_Content/pdf/ordinances/O-16-64.pdf';
export const BAYONNE_PARKING_PAGE = 'https://www.bayonnenj.org/Departments/parking-utility';
/** SHA-256 of the file transcribed on 2026-11-07 (69,776 bytes, Last-Modified Fri, 15 Jan 2021 16:54:38 GMT). */
export const TRANSCRIBED_SHA256 = '368a812d7e6da097ae3ce6b134015d9f2b99380758a654cc00e16a2796c896ea';

export const bayonneParkingLots: SourceDefinition = {
  id: 'bayonne-parking-lots',
  publisher: 'City of Bayonne',
  title: 'Ordinance O-16-64, Time-Limited Metered Parking Lots',
  datasetUrl: BAYONNE_ORDINANCE,
  // The City's site states no terms beyond a copyright line (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: BAYONNE_ORDINANCE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'names_from_streets'],
  // An ordinance changes only when the Council amends it. A weekly check is plenty, and an unchanged file is skipped (ING-7).
  schedule: '20 6 * * 4',
  fetch: fetchOrdinance,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'bayonne-parking-lots', normalizeBayonne(snapshot.body), snapshot.fetchedAt),
};

async function fetchOrdinance(http: UpstreamHttp): Promise<FetchedData> {
  const file = await http.get(BAYONNE_ORDINANCE, { accept: 'application/pdf' });
  const modified = file.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: file.body, contentType: file.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

interface Lot {
  /** The ordinance's item number in § 7-38.2 a. */
  zone: number;
  name: string;
  addressLine: string;
  lat: number;
  lng: number;
  basis: string;
}

/**
 * The ordinance's lots, transcribed on 2026-11-07, each placed at the centre of its tax parcels in the State's layer
 * (the mean where there are several). Lots that changed since 2016 are left out (LEFT_OUT).
 */
export const LOTS: readonly Lot[] = [
  { zone: 1, name: 'East 19th Street Lot', addressLine: 'E 19th St, south side, Broadway to Avenue E', lat: 40.66083, lng: -74.12005,
    basis: 'block 226, lots 34 and 35; today parcel 0901_226_35.02, 12 E 19th St, "parking lot / parking area"' },
  { zone: 3, name: 'West 21st Street Lot', addressLine: 'W 21st St, south side, Broadway to Avenue C', lat: 40.66281, lng: -74.12037,
    basis: 'block 216, lots 22 and 23, "parking area"' },
  { zone: 4, name: 'West 22nd Street Lot', addressLine: 'W 22nd St, north side, Broadway to Avenue C', lat: 40.66383, lng: -74.11961,
    basis: 'block 203, lot 4, "parking area"' },
  { zone: 5, name: 'West 24th Street Lot (south side)', addressLine: 'Behind 509-515 Broadway, south side of W 24th St', lat: 40.66484, lng: -74.1188,
    basis: 'block 195, lot 2; today parcel 0901_195_2.01, "parking area"' },
  { zone: 6, name: 'West 24th Street Lot (north side)', addressLine: 'Behind 527-531 Broadway, north side of W 24th St', lat: 40.66545, lng: -74.11801,
    basis: 'block 189, lots 19, 6, and 22; lot 22 is "parking lot / parking area", lot 6 is now a house, and lot 19 is gone' },
  { zone: 7, name: 'East 24th Street Lot (south side)', addressLine: 'E 24th St, south side, Broadway to Avenue E', lat: 40.66423, lng: -74.11685,
    basis: 'block 198, lot 15, "parking area"' },
  { zone: 8, name: 'East 24th Street Lot (north side)', addressLine: 'E 24th St, north side, Broadway to Avenue E', lat: 40.66463, lng: -74.11656,
    basis: 'block 191, lot 1, "parking area"' },
  { zone: 10, name: 'East 26th Street Lot (north side)', addressLine: 'E 26th St, north side, Broadway to Avenue E', lat: 40.66616, lng: -74.11468,
    basis: 'block 179, lots 4, 5, and 6, "parking areas"' },
  { zone: 11, name: 'East 33rd Street Lot', addressLine: 'E 33rd St, north side, Broadway to Avenue E', lat: 40.67201, lng: -74.1102,
    basis: 'block 140, lots 5.01 and 5.02, "parking lot / parking area"' },
];

/** In the ordinance, but their parcels have changed since 2016; left out on purpose (specs/06). */
export const LEFT_OUT: Readonly<Record<number, string>> = {
  2: 'block 221, between E 19th and E 21st Streets: its lots are now public housing, vacant land, and a park',
  9: 'block 184, lot 11, "westerly portion": a public housing parcel, too large to place the lot on',
  12: 'block 277, lots 26 and 27, 9-11 W 9th St: now recorded as a maintenance building',
};

export function normalizeBayonne(body: Uint8Array): Normalized {
  // ING-15: the transcription is only good for the file it was made from.
  const sha256 = createHash('sha256').update(body).digest('hex');
  if (sha256 !== TRANSCRIBED_SHA256) {
    throw new IngestionError('normalize.unexpected_format', 'the ordinance file changed; check it and update the transcription');
  }
  const records: SourceRecordInput[] = LOTS.map((lot) => {
    const slug = lot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return {
      recordId: `zone-${lot.zone}`,
      facilityKey: `bayonne-${slug}`,
      priority: 1,
      name: lot.name,
      matchTokens: matchTokens(lot.name),
      kind: 'lot',
      operatorName: 'Bayonne Parking Utility',
      operatorType: 'municipal',
      addressLine: lot.addressLine,
      locality: 'Bayonne',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: lot.lat,
      lng: lot.lng,
      // The City's own pages give no hours or spaces, and a rate can't be shown without its hours (ADR-0016).
      spaces: null,
      officialUrl: BAYONNE_PARKING_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    };
  });
  return { rowsRead: LOTS.length + Object.keys(LEFT_OUT).length, records, invalidRows: 0 };
}
