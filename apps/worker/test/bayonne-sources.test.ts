import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { BAYONNE_ORDINANCE, BAYONNE_PARKING_PAGE, bayonneParkingLots, LEFT_OUT, normalizeBayonne } from '../src/sources/bayonne-parking-lots.ts';
import { njParcelsHudsonParking } from '../src/sources/nj-parcels-parking.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

describe("Bayonne's metered lots (S4-18)", () => {
  it('ING-5 reads the ordinance from the City\'s site, with its Last-Modified date as the data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await bayonneParkingLots.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([BAYONNE_ORDINANCE]);
    expect(requests[0]!.headers.get('accept')).toBe('application/pdf');
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2021-01-15T16:54:38Z'));
    expect(fetched.body).toEqual(fixtures.bayonneOrdinance);
  });

  it('ADR-0016 shows the 9 lots still on their parcels, run by the Parking Utility, with nothing it doesn\'t give', () => {
    const { rowsRead, records, invalidRows } = normalizeBayonne(fixtures.bayonneOrdinance);

    expect(rowsRead).toBe(12);
    expect(invalidRows).toBe(0);
    expect(Object.keys(LEFT_OUT).map(Number)).toEqual([2, 9, 12]);
    expect(records.map((record) => record.name)).toEqual([
      'East 19th Street Lot',
      'West 21st Street Lot',
      'West 22nd Street Lot',
      'West 24th Street Lot (south side)',
      'West 24th Street Lot (north side)',
      'East 24th Street Lot (south side)',
      'East 24th Street Lot (north side)',
      'East 26th Street Lot (north side)',
      'East 33rd Street Lot',
    ]);
    expect(records.find((record) => record.recordId === 'zone-5')).toMatchObject({
      facilityKey: 'bayonne-west-24th-street-lot-south-side',
      addressLine: 'Behind 509-515 Broadway, south side of W 24th St',
      lat: 40.66484,
      lng: -74.1188,
    });
    for (const record of records) {
      expect(record).toMatchObject({
        kind: 'lot',
        operatorName: 'Bayonne Parking Utility',
        operatorType: 'municipal',
        locality: 'Bayonne',
        officialUrl: BAYONNE_PARKING_PAGE,
        confirmed: true,
        spaces: null,
        rates: [],
        meterPeriods: [],
      });
    }
  });

  it('ING-15 fails the run, changing nothing, when the City replaces the ordinance file', async () => {
    const logger = testLogger().logger;
    await runSource(bayonneParkingLots, { sql, http: fixtureHttp().http, logger });
    const changed = new Uint8Array(fixtures.bayonneOrdinance);
    changed[changed.length - 2] = changed[changed.length - 2]! ^ 1;

    const outcome = await runSource(bayonneParkingLots, { sql, http: fixtureHttp({ bayonneOrdinance: changed }).http, logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.unexpected_format' });
    const lots = await sql`select id from facility where status = 'active'`;
    expect(lots).toHaveLength(9);
  });

  it('ING-14 merges the tax-record sites that are these lots, with the City\'s lot as the primary', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    await runSource(njParcelsHudsonParking, context);
    await runSource(bayonneParkingLots, context);

    const bayonne = await sql<{ id: string; name: string; confirmed: boolean }[]>`
      select id, name, confirmed from facility where status = 'active' and locality = 'Bayonne' order by id`;
    expect(bayonne.filter((facility) => facility.confirmed)).toHaveLength(9);
    // Two of the six sites are the lots behind 509-515 Broadway and on East 33rd Street; four stay unconfirmed.
    expect(bayonne.filter((facility) => !facility.confirmed).map((facility) => facility.name).sort()).toEqual([
      '276 Prospect Ave', '624-628 Broadway', '92 E 19th St', 'Prospect Ave',
    ]);
    const links = await sql`select source_id from facility_source where facility_id = 'bayonne-east-33rd-street-lot' order by source_id`;
    expect(links.map((link) => link.source_id)).toEqual(['bayonne-parking-lots', 'nj-parcels-hudson-parking']);
  });
});
