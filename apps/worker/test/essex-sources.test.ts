import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { BLOOMFIELD_METERS_PAGE, bloomfieldParkingLots, normalizeBloomfield } from '../src/sources/bloomfield-parking-lots.ts';
import { ESSEX, njParcelsEssexParking, normalizeCandidates } from '../src/sources/nj-parcels-parking.ts';
import { normalizeNutley, NUTLEY_PARKING_PAGE, nutleyParkingLots } from '../src/sources/nutley-parking-lots.ts';
import { normalizeSouthOrange, SOUTH_ORANGE_METERS_PAGE, southOrangeParkingLots } from '../src/sources/south-orange-parking-lots.ts';
import { normalizeVerona, veronaParkingLots } from '../src/sources/verona-parking-lots.ts';
import { fixtureHttp, fixtures, PARCELS_SERVICE_PATH } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const text = (body: Uint8Array) => new TextDecoder().decode(body);
const edited = (body: Uint8Array, from: string, to: string) => {
  if (!text(body).includes(from)) throw new Error(`the saved page has no ${from}`);
  return new TextEncoder().encode(text(body).replace(from, to));
};

describe('Essex County candidate sites from tax records (S4-25)', () => {
  it('ING-2 asks the parcel layer for Essex, with the neighbours in parts', async () => {
    const { http, requests } = fixtureHttp();

    await njParcelsEssexParking.fetch(http);

    const wheres = requests.filter((request) => new URL(request.url).pathname === `${PARCELS_SERVICE_PATH}/0/query`)
      .map((request) => new URL(request.url).searchParams.get('where') ?? '');
    expect(wheres[0]).toContain("COUNTY='ESSEX' AND PROP_CLASS='15C'");
    expect(wheres.slice(1).every((where) => where.includes("PCL_MUN='07"))).toBe(true);
    expect(requests.every((request) => request.url.length <= 1_800)).toBe(true);
  });

  it('ING-13 keeps sites in 15 of Essex\'s towns, and leaves out land taken for unpaid taxes', async () => {
    const { rowsRead, records, invalidRows } = normalizeCandidates((await njParcelsEssexParking.fetch(fixtureHttp().http)).body, ESSEX);
    const towns: Record<string, number> = {};
    for (const record of records) towns[record.locality] = (towns[record.locality] ?? 0) + 1;

    expect(rowsRead).toBe(289);
    expect(invalidRows).toBe(0);
    // Nutley's permit-only Lot #6 (11 East Plaza) is left out as not for visitors (ADR-0017), and Glen Ridge's site
    // shares its block with a swimming pool (ADR-0019).
    expect(records).toHaveLength(98);
    expect(towns).toMatchObject({ Newark: 30, 'East Orange': 13, Montclair: 7, Bloomfield: 2, 'South Orange': 2, Nutley: 1 });
    expect(towns['Glen Ridge']).toBeUndefined();
    const names = records.map((record) => record.name);
    expect(names).not.toContain('463-465 Roseville Ave'); // "parking / tax lien foreclosure"
    expect(records.find((record) => record.name === 'Crescent Plaza')).toMatchObject({ kind: 'garage', locality: 'Montclair', facilityKey: 'montclair-site-2206-13' });
    for (const record of records) expect(record).toMatchObject({ confirmed: false, operatorType: 'unknown', region: 'NJ' });
  });
});

describe("Bloomfield's metered lots (S4-26)", () => {
  it('ING-5 reads the Parking Utility\'s meter page, with its Last-Modified date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await bloomfieldParkingLots.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([BLOOMFIELD_METERS_PAGE]);
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2026-11-05T17:20:43Z'));
  });

  it('REC-10 shows each placed lot with its meter hours, time limit, and rate per hour', () => {
    const { rowsRead, records, invalidRows } = normalizeBloomfield(fixtures.bloomfieldMeters);

    expect([rowsRead, invalidRows]).toEqual([3, 0]);
    expect(records.map((record) => [record.name, record.meterPeriods[0]?.maxStayMinutes])).toEqual([['Pitt St. Lot', 720], ['Conger St Lot', 120]]);
    for (const record of records) {
      expect(record).toMatchObject({ operatorName: 'Bloomfield Parking Utility', operatorType: 'municipal', locality: 'Bloomfield', confirmed: true });
      expect(record.rates).toEqual([{ days: 63, startsAt: '08:00', endsAt: '18:00', kind: 'per_hour', upToMinutes: null, amountMinor: 100, currency: 'USD' }]);
    }
  });

  it('ING-3 fails, rather than guess, when a lot\'s hours are worded differently', () => {
    expect(() => normalizeBloomfield(edited(fixtures.bloomfieldMeters, 'Two Hour Parking', 'Short Parking'))).toThrow(/Conger St Lot changed/);
  });
});

describe("South Orange's metered lots (S4-27)", () => {
  it('REC-10 makes one lot of a lot\'s two kinds of meter, with both limits and rates', async () => {
    const fetched = await southOrangeParkingLots.fetch(fixtureHttp().http);
    const { rowsRead, records, invalidRows } = normalizeSouthOrange(fetched.body);

    expect([rowsRead, invalidRows]).toEqual([8, 0]);
    expect(records.map((record) => record.name).sort()).toEqual(['Irvington Avenue Lot 8', 'Library Lot 2', 'Riverside Lot 6', 'Taylor Place Garage', 'Village Hall Lot 4']);
    const riverside = records.find((record) => record.name === 'Riverside Lot 6')!;
    expect(riverside).toMatchObject({ addressLine: 'West South Orange Avenue', kind: 'lot', operatorName: 'South Orange Parking Authority', officialUrl: SOUTH_ORANGE_METERS_PAGE });
    expect(riverside.meterPeriods.map((period) => period.maxStayMinutes)).toEqual([180, 60]);
    expect(riverside.rates.map((rate) => rate.amountMinor)).toEqual([100, 25]);
    // The page's exception: 12-hour meters are enforced from 6am.
    expect(records.find((record) => record.name === 'Library Lot 2')?.meterPeriods).toEqual([
      expect.objectContaining({ startsAt: '06:00', endsAt: '18:00', maxStayMinutes: 720 })]);
    expect(records.find((record) => record.name === 'Taylor Place Garage')?.kind).toBe('garage');
  });

  it('ING-10 counts an entry for a lot it doesn\'t know as a row it can\'t read', () => {
    const { invalidRows } = normalizeSouthOrange(edited(fixtures.southOrangeMeters, 'Library Lot 2 &ndash;', 'Library Lot 3 &ndash;'));

    expect(invalidRows).toBe(1);
  });

  it('ING-3 fails when the enforcement hours are worded differently', () => {
    expect(() => normalizeSouthOrange(edited(fixtures.southOrangeMeters, 'Monday - Saturday, 8am - 6pm', 'Monday - Friday, 8am - 6pm'))).toThrow(/enforcement hours/);
  });
});

describe("Nutley's metered lots (S4-29)", () => {
  it('REC-10 shows the six metered lots, enforced around the clock at $1.00 an hour, and leaves out the permit lots', async () => {
    const fetched = await nutleyParkingLots.fetch(fixtureHttp().http);
    const { rowsRead, records, invalidRows } = normalizeNutley(fetched.body);

    expect([rowsRead, invalidRows]).toEqual([9, 0]);
    expect(records.map((record) => [record.name, record.meterPeriods[0]?.maxStayMinutes])).toEqual([
      ['Municipal Parking Lot #1', 240], ['Municipal Parking Lot #2', 180], ['Municipal Parking Lot #4', 120],
      ['Municipal Parking Lot #5', 120], ['Municipal Parking Lot #7', 180], ['Municipal Parking Lot #9', 180],
    ]);
    for (const record of records) {
      expect(record).toMatchObject({ operatorName: 'Township of Nutley', operatorType: 'municipal', locality: 'Nutley', officialUrl: NUTLEY_PARKING_PAGE });
      expect(record.meterPeriods[0]).toMatchObject({ days: 127, startsAt: '00:00', endsAt: '24:00' });
      expect(record.rates).toEqual([{ days: 127, startsAt: '00:00', endsAt: '24:00', kind: 'per_hour', upToMinutes: null, amountMinor: 100, currency: 'USD' }]);
    }
  });

  it('ING-3 fails when the lots\' enforcement hours are worded differently', () => {
    expect(() => normalizeNutley(edited(fixtures.nutleyParking, '24 hours per day, 7 days a week', '8am to 6pm'))).toThrow(/enforcement hours/);
  });
});

describe("Verona's lots (S4-30)", () => {
  it('ADR-0014 shows the two lots with their spaces and how to get in', async () => {
    const { records, invalidRows } = normalizeVerona((await veronaParkingLots.fetch(fixtureHttp().http)).body);

    expect(invalidRows).toBe(0);
    expect(records.map((record) => [record.name, record.addressLine, record.spaces])).toEqual([
      ['Municipal Lot 1', 'Park Place (opposite Lakeside Ave), off Bloomfield Ave', 67],
      ['Municipal Lot 2', 'Grove Ave, approximately 50 feet north of Bloomfield Ave', 32],
    ]);
  });

  it('ING-10 counts a lot described differently as a row it can\'t read, and ING-3 fails when none read', () => {
    const one = edited(fixtures.veronaParking, 'metered parking spaces and', 'meters and');
    expect(normalizeVerona(one)).toMatchObject({ rowsRead: 2, invalidRows: 1 });
    expect(() => normalizeVerona(edited(one, 'metered parking spaces and', 'meters and'))).toThrow(/expected wording/);
  });
});

describe("Essex's sources together (ING-14)", () => {
  it('ING-14 merges the tax-record sites that are these lots into them', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    for (const source of [njParcelsEssexParking, bloomfieldParkingLots, southOrangeParkingLots, nutleyParkingLots, veronaParkingLots]) await runSource(source, context);

    const sourcesOf = async (id: string) =>
      (await sql`select source_id from facility_source where facility_id = ${id} order by source_id`).map((link) => link.source_id);
    expect(await sourcesOf('south-orange-irvington-avenue-lot-8')).toEqual(['nj-parcels-essex-parking', 'south-orange-parking-lots']);
    expect(await sourcesOf('bloomfield-pitt-st-lot')).toEqual(['bloomfield-parking-lots', 'nj-parcels-essex-parking']);
    expect(await sourcesOf('verona-lot-2')).toEqual(['nj-parcels-essex-parking', 'verona-parking-lots']);
    const rates = await sql`select amount_minor from facility_rate where facility_id = 'bloomfield-pitt-st-lot'`;
    expect(rates.map((rate) => rate.amount_minor)).toEqual([100]);
  });
});
