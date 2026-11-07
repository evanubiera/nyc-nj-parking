// S4-36: Oradell's municipal parking lots, from the Borough's Municipal Parking page (specs/06, "Oradell"). The page
// lists the lots "for public use", one per line, each with where it is in brackets. It leaves their time limits to the
// Borough Code, which is on eCode360 and can't be republished, so no hours are shown. It has no coordinates, so each lot
// was placed once on its tax parcel (LOCATIONS). The site states no terms beyond a copyright notice; admitted without
// asking first (ADR-0014).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const ORADELL_PARKING_PAGE = 'https://www.oradell.org/1410/Municipal-Parking';

export const oradellParkingLots: SourceDefinition = {
  id: 'oradell-parking-lots',
  publisher: 'Borough of Oradell',
  title: 'Municipal Parking',
  datasetUrl: ORADELL_PARKING_PAGE,
  // The site's copyright notice is all it states (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: 'https://www.oradell.org/site/copyright',
  creditText: null,
  modificationCodes: ['locations_from_records'],
  schedule: '0 7 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'oradell-parking-lots', normalizeOradell(snapshot.body), snapshot.fetchedAt),
};

/** The site's Last-Modified header is the time of the request (checked 2026-11-07), so it isn't the data's date. */
async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(ORADELL_PARKING_PAGE, { accept: 'text/html' });
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: null };
}

/** Where each lot is, by its name on the page less "Municipal Parking Lot", checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  Upper: { lat: 40.95313, lng: -74.03292, basis: 'parcel 0244_407_3, 355 Kinderkamack Rd, "Oradell Boro Hall"' },
  Library: { lat: 40.95375, lng: -74.03251, basis: 'parcel 0244_406_9, "Oradell Public Lib.", between Oradell Ave and Church St' },
  'Schirra Park': { lat: 40.95431, lng: -74.03063, basis: 'parcel 0244_1101_1, "Schirra Park", between Oradell Ave and Veldran Ave' },
  'Veterans Memorial Building / Senior Center': { lat: 40.95518, lng: -74.03048, basis: 'parcel 0244_1102_4, "Veldran Ave Park Lot", behind the post office (0244_1102_2) and beside Kinderkamack Post 41 (1 Veterans Place)' },
  'World War I Memorial': { lat: 40.95413, lng: -74.02982, basis: 'parcel 0244_1104_1, Veldran Ave, "parking area", north of Oradell Ave and east of the railroad' },
  Meyerhoff: { lat: 40.94264, lng: -74.02993, basis: 'parcel 0244_104_1, "KK Road parking lot", between Kinderkamack Rd and Meyerhoff Place, south of Mackay Ave' },
  'Pyle Street / Lake Avenue': { lat: 40.94815, lng: -74.03254, basis: 'parcel 0244_211_16, "Lake & Martin Avenues", "parking area", at Pyle St' },
  'Park Avenue': { lat: 40.95152, lng: -74.03291, basis: 'parcel 0244_408_14.01, 632 Park Ave, "parking lot", behind the business at 317 Kinderkamack Rd, on the corner' },
};

/**
 * Listed, but not placed with confidence on 2026-11-07 (specs/06); left out on purpose. The only public parcel north of
 * Waite Place and east of Kinderkamack Road is a 4.75-acre playground, whose centre is well away from the lot.
 */
export const UNLOCATED = new Set(['Waite Place']);

export interface ListedLot {
  /** The name less "Municipal Parking Lot", such as "Meyerhoff". */
  short: string;
  where: string;
}

/** The lines between the page's opening sentence and "Please note:", each "<name> Municipal Parking Lot (<where>)". */
export function listedLots(text: string): { lots: ListedLot[]; unread: number } {
  const start = text.indexOf('\nThe Borough has municipal parking lots for public use in the following locations:\n');
  const end = text.indexOf('\nPlease note:', start);
  if (start < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no list of municipal parking lots');
  const lines = text.slice(start, end).split('\n').slice(2);
  const lots = lines.flatMap((line) => {
    const match = /^(.+?) Municipal Parking Lot \((.+)\)$/.exec(line);
    return match ? [{ short: match[1]!, where: match[2]! }] : [];
  });
  return { lots, unread: lines.length - lots.length };
}

export function normalizeOradell(body: Uint8Array): Normalized {
  const { lots, unread } = listedLots(pageText(body));
  const records: SourceRecordInput[] = [];
  let invalidRows = unread;
  for (const lot of lots) {
    if (UNLOCATED.has(lot.short)) continue;
    const location = LOCATIONS[lot.short];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const name = `${lot.short} Municipal Parking Lot`;
    const slug = lot.short.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    records.push({
      recordId: slug,
      facilityKey: `oradell-${slug}-lot`,
      priority: 1,
      name,
      matchTokens: matchTokens(name),
      kind: 'lot',
      operatorName: 'Borough of Oradell',
      operatorType: 'municipal',
      addressLine: lot.where.charAt(0).toUpperCase() + lot.where.slice(1),
      locality: 'Oradell',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: null,
      officialUrl: ORADELL_PARKING_PAGE,
      meterPeriods: [],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length + unread, records, invalidRows };
}
