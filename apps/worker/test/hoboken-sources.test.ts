import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { HOBOKEN_GARAGES_PAGE, hobokenGarages, normalizeHoboken } from '../src/sources/hoboken-garages.ts';
import { withoutEmailAddresses } from '../src/sources/html.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const html = new TextDecoder().decode(fixtures.hobokenGarages);
const edited = (from: string, to: string) => {
  if (!html.includes(from)) throw new Error(`the saved page has no ${from}`);
  return new TextEncoder().encode(html.replace(from, to));
};

describe("Hoboken's garages (S4-13)", () => {
  it('ING-5 reads the page, with its Last-Modified date as the data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await hobokenGarages.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([HOBOKEN_GARAGES_PAGE]);
    expect(requests[0]!.headers.get('accept')).toBe('text/html');
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2026-11-06T22:16:52Z'));
  });

  it('ING-2 removes email addresses from the page before it is stored', async () => {
    const page = edited('Contact Info', 'Contact Info <a href="mailto:someone.staff@hobokennj.gov">someone.staff@hobokennj.gov</a>');

    const fetched = await hobokenGarages.fetch(fixtureHttp({ hobokenGarages: page }).http);

    const stored = new TextDecoder().decode(fetched.body);
    expect(stored).not.toContain('someone.staff');
    expect(stored).toContain('mailto:[email address removed]');
    expect(withoutEmailAddresses(new TextEncoder().encode('a@b.org, c.d@e.example.com'))).toEqual(
      new TextEncoder().encode('[email address removed], [email address removed]'));
  });

  it('ADR-0015 shows the garages taking hourly parkers, with their capacity, and leaves out Garage G', () => {
    const { rowsRead, records, invalidRows } = normalizeHoboken(fixtures.hobokenGarages);

    expect(rowsRead).toBe(4);
    expect(invalidRows).toBe(0);
    expect(records.map((record) => [record.name, record.addressLine, record.spaces])).toEqual([
      ['Garage B', '28 2nd Street', 829],
      ['Garage D', '215 Hudson Street', 488],
      ['Midtown Garage', '371 4th Street', 730],
    ]);
    for (const record of records) {
      expect(record).toMatchObject({
        kind: 'garage',
        operatorName: 'Hoboken Parking Utility',
        operatorType: 'municipal',
        locality: 'Hoboken',
        officialUrl: HOBOKEN_GARAGES_PAGE,
        confirmed: true,
        rates: [],
        meterPeriods: [],
      });
    }
  });

  it('ADR-0015 shows Garage G once the page lists it as available', () => {
    const page = edited('<td>Not Available</td>', '<td>Available</td>');

    const { records } = normalizeHoboken(page);

    expect(records.find((record) => record.name === 'Garage G')).toMatchObject({ facilityKey: 'hoboken-garage-g', lat: 40.74041, lng: -74.02839 });
  });

  it('ING-10 counts a garage it has no location for as a row it can\'t read', () => {
    const { records, invalidRows } = normalizeHoboken(edited('<td>Garage D</td>', '<td>Garage E</td>'));

    expect(invalidRows).toBe(1);
    expect(records.map((record) => record.name)).toEqual(['Garage B', 'Midtown Garage']);
  });

  it('ING-3 fails the run, changing nothing, when the availability table is gone', async () => {
    const http = fixtureHttp().http;
    await runSource(hobokenGarages, { sql, http, logger: testLogger().logger });
    const page = edited('>Capacity', '>Spaces');

    const outcome = await runSource(hobokenGarages, { sql, http: fixtureHttp({ hobokenGarages: page }).http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.unexpected_format' });
    const garages = await sql`select id from facility where status = 'active' order by id`;
    expect(garages.map((garage) => garage.id)).toEqual(['hoboken-garage-b', 'hoboken-garage-d', 'hoboken-midtown-garage']);
  });
});
