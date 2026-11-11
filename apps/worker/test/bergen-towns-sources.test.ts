import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { njParcelsBergenParking } from '../src/sources/nj-parcels-parking.ts';
import { njtParkingLots } from '../src/sources/njt-parking-lots.ts';
import { normalizeOradell, ORADELL_PARKING_PAGE, oradellParkingLots } from '../src/sources/oradell-parking-lots.ts';
import {
  normalizeWestwood,
  plainWhere,
  WESTWOOD_CUSTOMER_PAGE,
  WESTWOOD_UTILITY_PAGE,
  westwoodParkingLots,
} from '../src/sources/westwood-parking-lots.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const text = (body: Uint8Array) => new TextDecoder().decode(body);
const edited = (body: Uint8Array, from: string, to: string) => {
  if (!text(body).includes(from)) throw new Error(`the saved page has no ${from}`);
  return new TextEncoder().encode(text(body).replace(from, to));
};

describe("Westwood's municipal lots (S4-35)", () => {
  it('ING-3 checks the Parking Utility page\'s meter hours, then stores the customer page', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await westwoodParkingLots.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([WESTWOOD_UTILITY_PAGE, WESTWOOD_CUSTOMER_PAGE]);
    expect(text(fetched.body)).toContain('MUNICIPAL LOTS');
  });

  it('ING-3 fails, rather than guess, when the meter hours read differently', async () => {
    const { http } = fixtureHttp({ westwoodUtility: edited(fixtures.westwoodUtility, 'Monday - Saturday, 9:00 am - 6:00 pm', 'Monday - Friday, 9:00 am - 6:00 pm') });

    await expect(westwoodParkingLots.fetch(http)).rejects.toThrow(/meter hours changed/);
  });

  it('REC-10 shows four lots with their shopper spaces and time limits, enforced Monday to Saturday 9am to 6pm', () => {
    const { rowsRead, records, invalidRows } = normalizeWestwood(fixtures.westwoodCustomer);

    expect([rowsRead, invalidRows]).toEqual([6, 0]);
    expect(records.map((record) => [record.name, record.spaces, record.meterPeriods[0]?.maxStayMinutes])).toEqual([
      ['Fairview Avenue Lot', 43, 180],
      ['Center Avenue Lot North', 77, 120],
      ['Firehouse Lot', 13, 120],
      ['Center Avenue Lot South', 56, 540],
    ]);
    for (const record of records) {
      expect(record).toMatchObject({ operatorName: 'Westwood Parking Utility', operatorType: 'municipal', locality: 'Westwood', officialUrl: WESTWOOD_CUSTOMER_PAGE, rates: [] });
      expect(record.meterPeriods[0]).toMatchObject({ days: 63, startsAt: '09:00', endsAt: '18:00' });
    }
    expect(records.find((record) => record.name === 'Firehouse Lot')?.addressLine).toBe('South end of Center Ave, next to Fire House parking');
  });

  it('ADR-0007 leaves out the privately owned Center Square Lot and the Saturday-only Municipal Building lot', () => {
    const names = normalizeWestwood(fixtures.westwoodCustomer).records.map((record) => record.name);

    expect(names).not.toContain('Center Square Lot');
    expect(names.some((name) => /Municipal Building/.test(name))).toBe(false);
  });

  it('ING-10 counts a lot entry it can\'t read, and ING-3 fails when the note on private lots changes', () => {
    expect(normalizeWestwood(edited(fixtures.westwoodCustomer, 'Firehouse Lot (South end', 'Firehouse Lot South end')).invalidRows).toBe(1);
    expect(() => normalizeWestwood(edited(fixtures.westwoodCustomer, '*Privately owned lot', '*Lot'))).toThrow(/marked "\*"/);
  });

  it('REC-4 turns the page\'s emphasis into a plain facility address', () => {
    expect(plainWhere('west side')).toBe('West side');
    expect(plainWhere('South end of Center Ave. NEXT TO Fire House parking')).toBe('South end of Center Ave, next to Fire House parking');
  });
});

describe("Oradell's municipal lots (S4-36)", () => {
  it('ATT-2 dates the data by the run, not by a Last-Modified header that is the time of the request', async () => {
    const fetched = await oradellParkingLots.fetch(fixtureHttp().http);

    expect(fetched.upstreamUpdatedAt).toBeNull();
  });

  it('ADR-0014 shows eight of the nine lots for public use, with where each is, and leaves out the one not placed', async () => {
    const { rowsRead, records, invalidRows } = normalizeOradell((await oradellParkingLots.fetch(fixtureHttp().http)).body);

    expect([rowsRead, invalidRows]).toEqual([9, 0]);
    expect(records.map((record) => record.name)).toEqual([
      'Upper Municipal Parking Lot', 'Library Municipal Parking Lot', 'Schirra Park Municipal Parking Lot',
      'Veterans Memorial Building / Senior Center Municipal Parking Lot', 'World War I Memorial Municipal Parking Lot',
      'Meyerhoff Municipal Parking Lot', 'Pyle Street / Lake Avenue Municipal Parking Lot', 'Park Avenue Municipal Parking Lot',
    ]);
    expect(records.find((record) => record.name.startsWith('Meyerhoff'))).toMatchObject({
      facilityKey: 'oradell-meyerhoff-lot', addressLine: 'On Kinderkamack Road between Mackay Avenue and Meyerhoff Place',
      operatorName: 'Borough of Oradell', operatorType: 'municipal', officialUrl: ORADELL_PARKING_PAGE, meterPeriods: [], rates: [],
    });
  });

  it('ING-10 counts a line it can\'t read, and ING-3 fails when the list is gone', () => {
    expect(normalizeOradell(edited(fixtures.oradellParking, 'Meyerhoff Municipal Parking Lot (', 'Meyerhoff Lot (')).invalidRows).toBe(1);
    expect(() => normalizeOradell(edited(fixtures.oradellParking, 'Please note:', 'Note:'))).toThrow(/no list/);
  });
});

describe("Bergen's town sources together (ING-14)", () => {
  it('ING-14 merges the tax-record sites that are these lots into them', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    for (const source of [njParcelsBergenParking, westwoodParkingLots, oradellParkingLots]) await runSource(source, context);

    const sourcesOf = async (id: string) =>
      (await sql`select source_id from facility_source where facility_id = ${id} order by source_id`).map((link) => link.source_id);
    for (const id of ['westwood-fairview-avenue-lot', 'westwood-center-avenue-lot-north', 'westwood-firehouse-lot', 'westwood-center-avenue-lot-south',
      'oradell-meyerhoff-lot', 'oradell-world-war-i-memorial-lot', 'oradell-pyle-street-lake-avenue-lot']) {
      expect(await sourcesOf(id)).toEqual(['nj-parcels-bergen-parking', id.startsWith('westwood') ? 'westwood-parking-lots' : 'oradell-parking-lots']);
    }
    const unconfirmed = await sql`select id from facility where locality in ('Westwood', 'Oradell') and confirmed = false and status = 'active'`;
    expect(unconfirmed).toEqual([]);
  });

  it('ING-14 makes NJ Transit\'s Oradell lots the Borough\'s, with the Borough\'s names and REC-10 NJ Transit\'s spaces', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    for (const source of [njtParkingLots, oradellParkingLots]) await runSource(source, context);

    const lots = await sql<{ id: string; name: string; spaces: number | null; sources: string }[]>`
      select f.id, f.name, f.spaces, (select string_agg(source_id, ',' order by source_id) from facility_source s where s.facility_id = f.id) as sources
      from facility f where f.status = 'active' and f.id like 'oradell-%' and f.spaces is not null order by f.id`;
    expect(lots.map((lot) => [lot.name, lot.spaces, lot.sources])).toEqual([
      ['Library Municipal Parking Lot', 134, 'njt-parking-lots,oradell-parking-lots'],
      ['Veterans Memorial Building / Senior Center Municipal Parking Lot', 131, 'njt-parking-lots,oradell-parking-lots'],
      ['World War I Memorial Municipal Parking Lot', 25, 'njt-parking-lots,oradell-parking-lots'],
    ]);
    expect(await sql`select id from facility where status = 'active' and id like 'njt-oradell%'`).toEqual([]);
  });
});
