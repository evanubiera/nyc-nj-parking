// S4-12: West New York's municipal parking lots, from the Parking Utility's facilities page (specs/06, "West New
// York"). The page lists each lot's name, where it is, and its spaces, and states the meter hours, the meter rate,
// and the overnight pass for every lot. It has no coordinates, so each lot's location was checked by hand once
// (LOCATIONS); a lot the page adds that isn't located counts as a row that can't be read (ING-10). The page states
// no terms; it's admitted without asking first (ADR-0014, SRC-10), and comes out if West New York objects.
import type { TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import { applyNormalized } from '../facilities/apply.ts';
import type { Normalized, RateInput, SourceRecordInput } from '../facilities/types.ts';
import type { UpstreamHttp } from '../http.ts';
import type { MeterPeriod } from '../normalize/meter-hours.ts';
import { matchTokens } from '../normalize/names.ts';
import { NEW_YORK_TIME } from './nyc.ts';
import type { FetchedData, SourceDefinition, StoredSnapshot } from './types.ts';

export const WNY_FACILITIES_PAGE = 'https://www.westnewyorknj.org/pages/parking-services/facilities/';

export const wnyParkingLots: SourceDefinition = {
  id: 'wny-parking-lots',
  publisher: 'Town of West New York Parking Utility',
  title: 'Parking Services: Facilities',
  datasetUrl: WNY_FACILITIES_PAGE,
  // The page states no terms (SRC-10). Admitted, terms unstated (ADR-0014).
  termsUrl: WNY_FACILITIES_PAGE,
  creditText: null,
  modificationCodes: ['locations_from_records', 'rates_converted_to_hourly'],
  // The page changes rarely. A weekly check is plenty, and unchanged data is skipped (ING-7).
  schedule: '5 6 * * 4',
  fetch: fetchPage,
  apply: (tx: TransactionSql, snapshot: StoredSnapshot) => applyNormalized(tx, 'wny-parking-lots', normalizeWny(snapshot.body), snapshot.fetchedAt),
};

async function fetchPage(http: UpstreamHttp): Promise<FetchedData> {
  const page = await http.get(WNY_FACILITIES_PAGE, { accept: 'text/html' });
  const modified = page.headers.get('last-modified');
  const updatedAt = modified ? new Date(modified) : null;
  return { body: page.body, contentType: page.contentType, upstreamUpdatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null };
}

/**
 * Where each lot is, checked on 2026-11-06 against the State's tax records (a public parcel the assessor
 * describes as parking, matching the page's description) or, where none matches, the State's geocoder.
 */
export const LOCATIONS: Record<string, { lat: number; lng: number; basis: string }> = {
  '67th Street Parking Lot': { lat: 40.79376, lng: -74.01184, basis: 'parcel 0912_16_7, 441 67th St, "municipal / parking area"' },
  '66th Street Parking Lot': { lat: 40.79023, lng: -74.00471, basis: 'parcel 0912_4_1, 6600-14 Park Ave, "parking lot"' },
  '63rd Street Parking Lot': { lat: 40.79214, lng: -74.01444, basis: 'parcel 0912_151_8, 6301 Bergenline Ave, "parking area"' },
  '62nd Street Outside Parking Lot': { lat: 40.79132, lng: -74.01578, basis: 'parcel 0912_140_16, 6134 Madison St, "park lot / parking area"' },
  '59th Street Parking Lot': { lat: 40.78815, lng: -74.01864, basis: 'parcel 0912_126_28, 5717 Madison St, "parking authority", beside Miller Stadium' },
  '58th Street East Side Parking Lot': { lat: 40.78697, lng: -74.01676, basis: 'parcel 0912_71_6, 429 58th St, "muni park lot"' },
  '54th Street Parking Lot': { lat: 40.78245, lng: -74.01223, basis: 'NJ_Geocode, midway between 54th St & Park Ave and 55th St & Park Ave' },
  '55th Street Parking Lot': { lat: 40.78387, lng: -74.01475, basis: 'parcel 0912_78_9, 229 55th St, "park lot"' },
  '51st Street Parking Lot': { lat: 40.78393, lng: -74.02175, basis: 'parcel 0912_108_32, 528 51st St, "parking lot"' },
};

/** Listed, but not placed with confidence on 2026-11-06 (specs/06); left out on purpose. */
export const UNLOCATED = new Set(['6701 Dewey Triangle Lot']);

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const DASH = '[-–—]';

/** "9:00am" → "09:00"; "9:01pm" → "21:01". */
function clock(time: string, half: string): string {
  const [h, m] = time.split(':').map(Number) as [number, number];
  const hours = (h % 12) + (half.toLowerCase() === 'pm' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "Monday – Saturday" → the bit mask for Monday through Saturday. */
function dayMask(first: string, last: string): number {
  const a = DAYS.indexOf(first.toLowerCase());
  const b = DAYS.indexOf(last.toLowerCase());
  if (a < 0 || b < a) throw new IngestionError('normalize.unexpected_format', 'unexpected day range');
  let mask = 0;
  for (let day = a; day <= b; day += 1) mask |= 1 << day;
  return mask;
}

/** The page's text, one block per line. */
export function pageText(body: Uint8Array): string {
  const html = new TextDecoder().decode(body);
  const text = html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, '\n')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#162;|&cent;/g, '¢');
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

/** The page's "Municipal Parking Lots" section: the lot rules and the list. */
function lotSection(text: string): string {
  const start = text.indexOf('\nMunicipal Parking Lots\n');
  const end = text.indexOf('\nMunicipal Lot Permits', start);
  if (start < 0 || end < 0) throw new IngestionError('normalize.unexpected_format', 'no "Municipal Parking Lots" section');
  return text.slice(start, end);
}

/**
 * The rules the page states for every lot, read only from the lots section: the street meters further down have a
 * different rate ("30-Minute parking = 25¢"). A wording change fails the run rather than guess (ING-3).
 */
export function lotRules(page: string): { meter: MeterPeriod; rates: RateInput[] } {
  const text = lotSection(page);
  const hours = new RegExp(`\\((\\w+day) ${DASH} (\\w+day) from (\\d{1,2}:\\d{2})(am|pm) ${DASH} (\\d{1,2}:\\d{2})(am|pm)\\)`, 'i').exec(text);
  const rate = /Lot rate is (\d+)-Minute parking = (\d+)¢/i.exec(text);
  const pass = /rate of \$(\d+)\.(\d{2}) per night/i.exec(text);
  const passHours = /starting at (\d{1,2}:\d{2})(am|pm) and it will cover parking until (\d{1,2}:\d{2})(am|pm)/i.exec(text);
  if (!hours || !rate || !pass || !passHours) {
    throw new IngestionError('normalize.unexpected_format', "the page's meter hours, rate, or overnight pass wording changed");
  }
  const days = dayMask(hours[1]!, hours[2]!);
  const startsAt = clock(hours[3]!, hours[4]!);
  const endsAt = clock(hours[5]!, hours[6]!);
  const [minutes, cents] = [Number(rate[1]), Number(rate[2])];
  return {
    meter: { days, startsAt, endsAt, maxStayMinutes: null, vehicleClass: null, sourceText: hours[0]!.slice(1, -1) },
    rates: [
      // "20-Minute parking = 25¢" is 75¢ an hour; we show it per hour (modification `rates_converted_to_hourly`).
      { days, startsAt, endsAt, kind: 'per_hour', upToMinutes: null, amountMinor: Math.round((cents * 60) / minutes), currency: 'USD' },
      { days: 127, startsAt: clock(passHours[1]!, passHours[2]!), endsAt: clock(passHours[3]!, passHours[4]!), kind: 'overnight_pass', upToMinutes: null,
        amountMinor: Number(pass[1]) * 100 + Number(pass[2]), currency: 'USD' },
    ],
  };
}

interface ListedLot {
  name: string;
  where: string | null;
  spaces: number;
}

/** The lots under "Municipal Parking Lots": a name ending in "Lot", where it is, and "N Spots". */
export function listedLots(page: string): ListedLot[] {
  const lines = lotSection(page).split('\n');
  const lots: ListedLot[] = [];
  lines.forEach((line, index) => {
    const spots = /^(\d+) spots$/i.exec(line);
    if (!spots) return;
    const nameAt = [index - 1, index - 2].find((at) => /\bLot$/.test(lines[at] ?? '') && lines[at] !== 'Metered Parking Lot');
    if (nameAt === undefined) return;
    const where = nameAt === index - 2 ? lines[index - 1]! : null;
    lots.push({ name: lines[nameAt]!, where: where === 'Metered Parking Lot' ? null : where, spaces: Number(spots[1]) });
  });
  return lots;
}

export function normalizeWny(body: Uint8Array): Normalized {
  const text = pageText(body);
  const { meter, rates } = lotRules(text);
  const lots = listedLots(text);
  const records: SourceRecordInput[] = [];
  let invalidRows = 0;
  for (const lot of lots) {
    if (UNLOCATED.has(lot.name)) continue;
    const location = LOCATIONS[lot.name];
    if (!location) {
      invalidRows += 1;
      continue;
    }
    const slug = lot.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    records.push({
      recordId: slug,
      facilityKey: `wny-${slug}`,
      priority: 1,
      name: lot.name,
      matchTokens: matchTokens(lot.name),
      kind: 'lot',
      operatorName: 'West New York Parking Utility',
      operatorType: 'municipal',
      addressLine: lot.where,
      locality: 'West New York',
      region: 'NJ',
      timeZone: NEW_YORK_TIME,
      lat: location.lat,
      lng: location.lng,
      spaces: lot.spaces,
      officialUrl: WNY_FACILITIES_PAGE,
      meterPeriods: [meter],
      rates,
      confirmed: true,
      lotNumber: null,
      withheldReason: null,
    });
  }
  return { rowsRead: lots.length, records, invalidRows };
}
