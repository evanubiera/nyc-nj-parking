// S4-35: Westwood's metered municipal lots, from the Parking Utility's Downtown Customer Parking page (specs/06,
// "Westwood"). Under "MUNICIPAL LOTS" the page groups the lots by time limit ("3 hours", "2 hours", "9 hours") and gives
// each lot's shopper spaces. The Parking Utility's own page says when the meters are enforced; that sentence is checked
// on every run. Left out: the Center Square Lot, which the page marks as privately owned, and the Municipal Building
// lot, which is for shoppers on Saturdays only. The page has no coordinates or meter rates, so each lot was placed once
// on its tax parcel (LOCATIONS), and no rate is shown. The site states no terms beyond a copyright notice; admitted
// without asking first (ADR-0014).
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import { matchTokens } from '../normalize/names.ts';
import { pageText, withoutEmailAddresses } from './html.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const WESTWOOD_CUSTOMER_PAGE = 'https://www.westwoodnj.gov/408/Downtown-Customer-Parking';
export const WESTWOOD_UTILITY_PAGE = 'https://www.westwoodnj.gov/399/Parking-Utility';

/** The Parking Utility page's sentence on meter hours, which every lot's time limit depends on. */
export const METER_HOURS_SENTENCE = 'Parking meter hours are enforced Monday - Saturday, 9:00 am - 6:00 pm.';

export const westwoodParkingLots: SourceDefinition = {
  id: 'westwood-parking-lots',
  publisher: 'Borough of Westwood Parking Utility',
  title: 'Downtown Customer Parking: Municipal Lots',
  datasetUrl: WESTWOOD_CUSTOMER_PAGE,
  // The site's copyright notice is all it states (specs/06). Admitted, terms unstated (ADR-0014).
  termsUrl: 'https://www.westwoodnj.gov/site/copyright',
  creditText: null,
  modificationCodes: ['locations_from_records', 'sites_not_for_visitors_excluded'],
  schedule: '55 6 * * 4',
  fetch: fetchPages,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
    applyNormalized(tx, 'westwood-parking-lots', normalizeWestwood(snapshot.body), snapshot.fetchedAt),
};

/**
 * The customer page is the snapshot. The Parking Utility page is read only to check that the meter hours still read as
 * transcribed; if they don't, the run fails and changes nothing (ING-3) until someone checks them.
 */
async function fetchPages(http: UpstreamHttp): Promise<FetchedData> {
  const utility = await http.get(WESTWOOD_UTILITY_PAGE, { accept: 'text/html' });
  if (!pageText(utility.body).includes(`\n${METER_HOURS_SENTENCE}\n`)) {
    throw new IngestionError('normalize.unexpected_format', "the Parking Utility page's meter hours changed");
  }
  const page = await http.get(WESTWOOD_CUSTOMER_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: withoutEmailAddresses(page.body), contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/** Where each lot is, by its name on the page, checked on 2026-11-07 against the State's tax records. */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  'Fairview Avenue Lot': { lat: 40.99159, lng: -74.03046, basis: 'parcel 0267_908_17, Fairview Ave, "parking lot", on the west side between Westwood Ave and Bergen St' },
  'Center Avenue Lot North': { lat: 40.99239, lng: -74.03256, basis: 'parcel 0267_807_19, 308 Center Ave, "parking lot", north of Westwood Ave' },
  'Firehouse Lot': { lat: 40.99013, lng: -74.03009, basis: 'parcel 0267_909_1, 93 Center Ave, "parking lot", beside the fire house at the south end of Center Ave' },
  'Center Avenue Lot South': { lat: 40.99066, lng: -74.03131, basis: 'parcel 0267_907_20, 146 Center Ave, "parking lot", south of Westwood Ave across from Bergen St' },
};

export interface ListedLot {
  name: string;
  where: string;
  spaces: number;
  limitHours: number;
  /** Marked "*": the page's note says the lot is privately owned. */
  private: boolean;
}

/** In page order: a time limit ("2 hours (141 spots)"), or a lot ("Center Avenue Lot North (North of …) (77)"). */
const ENTRY = /(\d+) hours \(\d+ spots ?\)|((?:[A-Z][a-z]+ )+Lot(?: North| South)?)(\*?) \(([^()]+)\) \((\d+)\)/g;

/**
 * The lots between "MUNICIPAL LOTS" and the Saturday-only lot, each under the time limit before it. A change in wording
 * fails the run (ING-3); an entry that looks like a lot but doesn't read as one is a row that can't be read (ING-10).
 */
export function listedLots(text: string): { lots: ListedLot[]; unread: number; saturdayOnly: number } {
  const start = text.indexOf('\nMUNICIPAL LOTS\n');
  const saturday = text.indexOf('\nON SATURDAY ONLY\n', start);
  const end = text.indexOf('\nDOWNTOWN EMPLOYEE PARKING\n', saturday);
  if (start < 0 || saturday < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no "MUNICIPAL LOTS" section');
  const flat = text.slice(start, saturday).replace(/\n/g, ' ');
  const lots: ListedLot[] = [];
  let limitHours: number | null = null;
  for (const entry of flat.matchAll(ENTRY)) {
    if (entry[1]) {
      limitHours = Number(entry[1]);
      continue;
    }
    if (limitHours === null) throw new IngestionError('normalize.unexpected_format', `${entry[2]} has no time limit before it`);
    lots.push({ name: entry[2]!, where: entry[4]!.trim(), spaces: Number(entry[5]), limitHours, private: entry[3] === '*' });
  }
  if (lots.some((lot) => lot.private) && !/\n\*Privately owned lot\b/.test(text)) {
    throw new IngestionError('normalize.unexpected_format', 'the note on lots marked "*" changed');
  }
  // Every lot entry ends in its spaces, such as "(43)"; a time limit's count reads "(43 spots)".
  const entries = flat.match(/\(\d+\)/g)?.length ?? 0;
  const saturdayOnly = text.slice(saturday, end).match(/\bParking lot\b/gi)?.length ?? 0;
  return { lots, unread: entries - lots.length, saturdayOnly };
}

/**
 * Where a lot is, as the page says it, as an address line: words in capitals for emphasis lower-cased, a sentence
 * break before them made a comma, and a capital first ("South end of Center Ave, next to Fire House parking").
 */
export function plainWhere(text: string): string {
  const lowered = text.replace(/\b[A-Z]{2,}\b/g, (word) => word.toLowerCase()).replace(/\. (?=[a-z])/, ', ');
  return lowered.charAt(0).toUpperCase() + lowered.slice(1);
}

export function normalizeWestwood(body: Uint8Array): Normalized {
  const { lots, unread, saturdayOnly } = listedLots(pageText(body));
  const records: SourceRecordInput[] = [];
  let invalidRows = unread;
  for (const lot of lots) {
    // A privately owned lot isn't shown (ADR-0007; modification `sites_not_for_visitors_excluded`).
    if (lot.private) continue;
    const location = LOCATIONS[lot.name];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const slug = lot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    records.push({
      recordId: slug,
      facilityKey: `westwood-${slug}`,
      priority: 1,
      name: lot.name,
      matchTokens: matchTokens(lot.name),
      kind: 'lot',
      operatorName: 'Westwood Parking Utility',
      operatorType: 'municipal',
      addressLine: plainWhere(lot.where),
      locality: 'Westwood',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      // The shopper spaces the page gives; employee spaces in the same lot aren't counted.
      spaces: lot.spaces,
      officialUrl: WESTWOOD_CUSTOMER_PAGE,
      // Monday to Saturday is days 1 to 32 (63). The page gives no rate for shoppers.
      meterPeriods: [{ days: 63, startsAt: '09:00', endsAt: '18:00', maxStayMinutes: lot.limitHours * 60, vehicleClass: null,
        sourceText: `${lot.limitHours} hours; ${METER_HOURS_SENTENCE}` }],
      rates: [],
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length + unread + saturdayOnly, records, invalidRows };
}
