import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { lotRules, normalizeWny, pageText, WNY_FACILITIES_PAGE, wnyParkingLots } from '../src/sources/wny-parking-lots.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const html = new TextDecoder().decode(fixtures.wnyFacilities);
// The page uses non-breaking spaces in places, so edits match any whitespace.
const edited = (from: string, to: string) =>
  new TextEncoder().encode(html.replace(new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')), to));

describe("West New York's lots (S4-12)", () => {
  it('ING-5 reads the page, with its Last-Modified date as the data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await wnyParkingLots.fetch(http);

    expect(requests.map((request) => request.url)).toEqual([WNY_FACILITIES_PAGE]);
    expect(requests[0]!.headers.get('accept')).toBe('text/html');
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2026-11-06T23:10:53Z'));
  });

  it('ING-10 reads the 10 listed lots and places 9; the Dewey Triangle lot is left out on purpose', () => {
    const { rowsRead, records, invalidRows } = normalizeWny(fixtures.wnyFacilities);

    expect(rowsRead).toBe(10);
    expect(invalidRows).toBe(0);
    expect(records.map((record) => record.name)).not.toContain('6701 Dewey Triangle Lot');
    expect(records.map((record) => [record.name, record.spaces])).toEqual([
      ['67th Street Parking Lot', 27],
      ['66th Street Parking Lot', 73],
      ['63rd Street Parking Lot', 33],
      ['62nd Street Outside Parking Lot', 241],
      ['59th Street Parking Lot', 205],
      ['58th Street East Side Parking Lot', 93],
      ['54th Street Parking Lot', 55],
      ['55th Street Parking Lot', 20],
      ['51st Street Parking Lot', 185],
    ]);
    expect(records.find((record) => record.name === '59th Street Parking Lot')).toMatchObject({
      addressLine: 'Between 57th & 59th on Madison Street (Behind Miller Stadium)',
      operatorName: 'West New York Parking Utility',
      operatorType: 'municipal',
      officialUrl: WNY_FACILITIES_PAGE,
      confirmed: true,
    });
  });

  it('REC-10 takes the meter hours, the rate per hour, and the overnight pass from the page', () => {
    const { meter, rates } = lotRules(pageText(fixtures.wnyFacilities));

    expect(meter).toEqual({ days: 63, startsAt: '09:00', endsAt: '21:00', maxStayMinutes: null, vehicleClass: null, sourceText: 'Monday – Saturday from 9:00am – 9:00pm' });
    expect(rates).toEqual([
      // "20-Minute parking = 25¢" is 75¢ an hour.
      { days: 63, startsAt: '09:00', endsAt: '21:00', kind: 'per_hour', upToMinutes: null, amountMinor: 75, currency: 'USD' },
      { days: 127, startsAt: '21:01', endsAt: '09:00', kind: 'overnight_pass', upToMinutes: null, amountMinor: 1000, currency: 'USD' },
    ]);
  });

  it('ING-10 counts a lot the page adds without a location as a row that can\'t be read', () => {
    const withNewLot = edited('51st Street Parking Lot', '49th Street Parking Lot');

    expect(normalizeWny(withNewLot)).toMatchObject({ rowsRead: 10, invalidRows: 1 });
  });

  it('ING-3 fails the run, changing nothing, when the page\'s rate wording changes', async () => {
    const outcome = await runSource(wnyParkingLots, {
      sql,
      http: fixtureHttp({ wnyFacilities: edited('20-Minute parking = 25¢', '30-Minute parking costs a quarter') }).http,
      logger: testLogger().logger,
    });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.unexpected_format' });
    expect(await sql`select 1 from facility`).toHaveLength(0);
  });

  it('REC-10 stores each lot\'s spaces, metered hours, and rates', async () => {
    const outcome = await runSource(wnyParkingLots, { sql, http: fixtureHttp().http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'succeeded', counts: { rowsRead: 10, rowsWritten: 9 } });
    const [lot] = await sql`select spaces, operator_type from facility where id = 'wny-66th-street-parking-lot'`;
    expect(lot).toEqual({ spaces: 73, operator_type: 'municipal' });
    const rates = await sql`
      select days, starts_at::text, ends_at::text, kind, amount_minor, currency from facility_rate
      where facility_id = 'wny-66th-street-parking-lot' order by kind`;
    expect(rates).toEqual([
      { days: 127, starts_at: '21:01:00', ends_at: '09:00:00', kind: 'overnight_pass', amount_minor: 1000, currency: 'USD' },
      { days: 63, starts_at: '09:00:00', ends_at: '21:00:00', kind: 'per_hour', amount_minor: 75, currency: 'USD' },
    ]);
    expect(await sql`select 1 from facility_meter_period where facility_id = 'wny-66th-street-parking-lot'`).toHaveLength(1);
    const [sum] = await sql<{ total: number }[]>`select sum(spaces)::int as total from facility`;
    expect(sum?.total).toBe(932);
  });
});
