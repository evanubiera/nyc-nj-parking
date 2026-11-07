import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { HARRISON_PARKING_PAGE, harrisonParkingCenter, normalizeHarrison } from '../src/sources/harrison-parking-center.ts';
import { njParcelsHudsonParking } from '../src/sources/nj-parcels-parking.ts';
import { fixOrdinals, normalizeUnionCity, UCPA_PARKING_PAGE, unionCityParkingLots } from '../src/sources/union-city-parking-lots.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const page = (body: Uint8Array) => new TextDecoder().decode(body);
const edited = (body: Uint8Array, from: string, to: string) => {
  if (!page(body).includes(from)) throw new Error(`the saved page has no ${from}`);
  return new TextEncoder().encode(page(body).replace(from, to));
};

describe("Union City's lots (S4-19)", () => {
  it('ING-5 reads the Parking Authority\'s page, which gives no data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await unionCityParkingLots.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([UCPA_PARKING_PAGE]);
    expect(fetched.upstreamUpdatedAt).toBeNull();
  });

  it('ADR-0014 shows the 6 lots open to visitors, city-run, and leaves out the 2 for permit holders', () => {
    const { rowsRead, records, invalidRows } = normalizeUnionCity(fixtures.ucpaParking);

    expect(rowsRead).toBe(8);
    expect(invalidRows).toBe(0);
    expect(records.map((record) => [record.name, record.kind])).toEqual([
      ['25th Street Lot', 'lot'],
      ['35th-36th Street Lot', 'lot'],
      ['39th-38th Street Deck', 'garage'],
      ['41st-42nd Street Lot', 'lot'],
      ['44th-45th Street Lot', 'lot'],
      ['47th-48th Street Lot', 'lot'],
    ]);
    expect(records.find((record) => record.name === '41st-42nd Street Lot')?.addressLine).toBe(
      'Between 41st & 42nd Street between Bergenline Ave. and Kennedy Blvd.');
    for (const record of records) {
      expect(record).toMatchObject({ operatorName: 'Union City Parking Authority', operatorType: 'municipal', locality: 'Union City',
        officialUrl: UCPA_PARKING_PAGE, confirmed: true, spaces: null, rates: [] });
    }
  });

  it('ING-10 counts a lot it has no location for as a row it can\'t read', () => {
    const { records, invalidRows } = normalizeUnionCity(edited(fixtures.ucpaParking, '25th Street Lot', '26th Street Lot'));

    expect(invalidRows).toBe(1);
    expect(records).toHaveLength(5);
  });

  it('ING-3 fails the run, changing nothing, when the lots section is gone', async () => {
    const logger = testLogger().logger;
    await runSource(unionCityParkingLots, { sql, http: fixtureHttp().http, logger });

    const outcome = await runSource(unionCityParkingLots, {
      sql, http: fixtureHttp({ ucpaParking: edited(fixtures.ucpaParking, 'Municipal Lot Locations', 'Our Lots') }).http, logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.unexpected_format' });
    expect(await sql`select id from facility where status = 'active'`).toHaveLength(6);
  });

  it('WEB-11 corrects the page\'s ordinals', () => {
    expect(fixOrdinals('41th & 42th, 11th, 12th, 23th, 101th')).toBe('41st & 42nd, 11th, 12th, 23rd, 101st');
  });
});

describe("Harrison's parking garage (S4-20)", () => {
  it('ADR-0014 shows the Town\'s garage by the PATH station, on its parcel', async () => {
    const fetched = await harrisonParkingCenter.fetch(fixtureHttp().http);
    const { records, invalidRows } = normalizeHarrison(fetched.body);

    expect(invalidRows).toBe(0);
    expect(records).toEqual([
      expect.objectContaining({
        facilityKey: 'harrison-parking-center',
        name: 'Harrison Parking Center',
        kind: 'garage',
        addressLine: '355 Somerset Street',
        operatorName: 'Town of Harrison',
        operatorType: 'municipal',
        locality: 'Harrison',
        lat: 40.7394,
        lng: -74.15685,
        officialUrl: HARRISON_PARKING_PAGE,
        confirmed: true,
        openingHours: [{ days: 127, opensAt: '00:00', closesAt: '24:00' }],
      }),
    ]);
  });

  it('S4-22 gives no opening hours when the page words them differently, rather than guess', () => {
    const { records } = normalizeHarrison(edited(fixtures.harrisonParking, 'Open 24/7', 'Open most days'));

    expect(records[0]?.openingHours).toEqual([]);
  });

  it('S4-22 writes the garage\'s opening hours to the facility', async () => {
    await runSource(harrisonParkingCenter, { sql, http: fixtureHttp().http, logger: testLogger().logger });

    const hours = await sql`select days, opens_at::text as opens, closes_at::text as closes from facility_hours where facility_id = 'harrison-parking-center'`;
    expect(hours).toEqual([{ days: 127, opens: '00:00:00', closes: '24:00:00' }]);
  });

  it('ING-3 fails the run when the page no longer gives the garage\'s address', async () => {
    const changed = edited(fixtures.harrisonParking, 'Harrison Parking Center', 'Harrison Garage');

    expect(() => normalizeHarrison(changed)).toThrow(/no "Harrison Parking Center" address/);
  });
});

describe('both, with the tax-record sites (ING-14)', () => {
  it('ING-14 merges the sites that are these lots into them', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    for (const source of [njParcelsHudsonParking, unionCityParkingLots, harrisonParkingCenter]) await runSource(source, context);

    const facilities = await sql<{ id: string; name: string; confirmed: boolean; locality: string }[]>`
      select id, name, confirmed, locality from facility where status = 'active' and locality in ('Union City', 'Harrison') order by id`;
    // Union City's 4 sites are its deck and its 41st-42nd and 47th-48th Street lots, and a lot between 37th and 38th
    // Streets that the Authority doesn't list; Harrison's garage site is the garage.
    expect(facilities.filter((facility) => !facility.confirmed).map((facility) => facility.name).sort()).toEqual([
      '512-16 37th/511-15 38th', '709-711 Harrison Ave', '717-719 Harrison Ave',
    ]);
    const links = await sql`select source_id from facility_source where facility_id = 'harrison-parking-center' order by source_id`;
    expect(links.map((link) => link.source_id)).toEqual(['harrison-parking-center', 'nj-parcels-hudson-parking']);
  });
});
