import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { AREA_IDS, areaOf } from '../src/facilities/areas.ts';
import { runSource } from '../src/run.ts';
import { westwoodParkingLots } from '../src/sources/westwood-parking-lots.ts';
import { fixtureHttp } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

describe('Areas: NJ counties and NYC boroughs (ADR-0021)', () => {
  it('REC-11 knows the 21 counties and 5 boroughs', () => {
    expect(AREA_IDS).toHaveLength(26);
    expect(AREA_IDS).toContain('nj-cape-may');
    expect(AREA_IDS).toContain('ny-staten-island');
  });

  it('REC-11 places a point in its county or borough', () => {
    expect(areaOf({ lat: 40.99066, lng: -74.03131, region: 'NJ' })).toBe('nj-bergen'); // Westwood's Center Avenue Lot South
    expect(areaOf({ lat: 40.79647, lng: -74.48296, region: 'NJ' })).toBe('nj-morris'); // Morristown
    expect(areaOf({ lat: 40.7359, lng: -74.0303, region: 'NJ' })).toBe('nj-hudson'); // Hoboken
    expect(areaOf({ lat: 38.9351, lng: -74.906, region: 'NJ' })).toBe('nj-cape-may');
    expect(areaOf({ lat: 40.719, lng: -73.988, region: 'NY' })).toBe('ny-manhattan'); // the Delancey and Essex garage
    expect(areaOf({ lat: 40.6782, lng: -73.9442, region: 'NY' })).toBe('ny-brooklyn');
    expect(areaOf({ lat: 40.7465, lng: -74.0105, region: 'NY' })).toBe('ny-manhattan'); // Chelsea Piers, in the Hudson
  });

  it('REC-11 gives a point near a coast its nearest area, and one far out at sea none', () => {
    expect(areaOf({ lat: 39.5583, lng: -74.2433, region: 'NJ' })).toBe('nj-ocean'); // Beach Haven, Long Beach Island
    expect(areaOf({ lat: 39.9, lng: -73.5, region: 'NJ' })).toBeNull();
  });

  it('REC-11 gives a point only an area in its own state: NJ Transit\'s Suffern lots, in New York State, have none', () => {
    // Suffern's lot A, 1 km over the state line from Mahwah, Bergen County (S4-45).
    expect(areaOf({ lat: 41.1169, lng: -74.1552, region: 'NY' })).toBeNull();
    expect(areaOf({ lat: 41.1169, lng: -74.1552, region: 'NJ' })).toBe('nj-bergen');
  });

  it('REC-11 sets each facility\'s area when the facilities are rebuilt', async () => {
    await runSource(westwoodParkingLots, { sql, http: fixtureHttp().http, logger: testLogger().logger });

    const areas = await sql<{ area: string | null }[]>`select distinct area from facility where status = 'active'`;
    expect(areas.map((row) => row.area)).toEqual(['nj-bergen']);
  });
});
