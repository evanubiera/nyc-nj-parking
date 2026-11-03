import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { nycFacdbDot } from '../src/sources/nyc-facdb-dot.ts';
import { nycMetersOffstreet } from '../src/sources/nyc-meters-offstreet.ts';
import { SOCRATA_LIMIT } from '../src/sources/socrata.ts';
import { fixtureHttp, fixtures, rowsWithout } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const encode = (text: string) => new TextEncoder().encode(text);

async function ingestBoth(http = fixtureHttp().http) {
  const context = { sql, http, logger: testLogger().logger };
  return [await runSource(nycFacdbDot, context), await runSource(nycMetersOffstreet, context)];
}

async function facilities() {
  return sql<{ id: string; status: string; name: string; withdrawn_at: Date | null }[]>`
    select id, status, name, withdrawn_at from facility order by id`;
}

describe('NYC sources', () => {
  it('ING-5 asks Socrata for the documented query, with the app token, and reads the data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await nycFacdbDot.fetch(http);

    const rowsUrl = new URL(requests[0]!.url);
    expect(rowsUrl.origin + rowsUrl.pathname).toBe('https://data.cityofnewyork.us/resource/ji82-xba5.json');
    expect(rowsUrl.searchParams.get('$where')).toBe("datasource='dot_publicparking'");
    expect(rowsUrl.searchParams.get('$limit')).toBe(String(SOCRATA_LIMIT));
    expect(requests.every((request) => request.headers.get('x-app-token') === 'fixture-token')).toBe(true);
    expect(new URL(requests[1]!.url).pathname).toBe('/api/views/ji82-xba5.json');
    expect(fetched.upstreamUpdatedAt).toEqual(new Date(1784223208 * 1000));
    expect(fetched.body).toEqual(fixtures.facdbRows);
  });

  it('ING-2 fails a response that reaches the row limit rather than keep part of it', async () => {
    const full = encode(JSON.stringify(Array.from({ length: SOCRATA_LIMIT }, () => ({}))));
    const outcome = await runSource(nycFacdbDot, { sql, http: fixtureHttp({ facdbRows: full }).http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'upstream.too_large' });
  });

  it('ATT-2 builds 38 facilities from both sources, each linked to the records it came from', async () => {
    const outcomes = await ingestBoth();

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['succeeded', 'succeeded']);
    expect(outcomes[0]?.counts).toEqual({ rowsRead: 35, rowsWritten: 35, rowsWithdrawn: 0 });
    expect(outcomes[1]?.counts).toEqual({ rowsRead: 184, rowsWritten: 29, rowsWithdrawn: 0 });
    const all = await facilities();
    expect(all).toHaveLength(38);
    expect(all.every((facility) => facility.status === 'active')).toBe(true);

    const links = await sql`select source_id from facility_source where facility_id = 'nyc-dot-avenue-m' order by source_id`;
    expect(links.map((link) => link.source_id)).toEqual(['nyc-facdb-dot', 'nyc-meters-offstreet']);
    const [source] = await sql`select data_updated_at from source where id = 'nyc-meters-offstreet'`;
    expect(source?.data_updated_at).toEqual(new Date(1793625373 * 1000));
  });

  it('REC-4 stores metered periods for metered fields, and none for the attended garages', async () => {
    await ingestBoth();

    const avenueM = await sql`
      select days, starts_at::text, ends_at::text, max_stay_minutes, vehicle_class, source_text
      from facility_meter_period where facility_id = 'nyc-dot-avenue-m' order by max_stay_minutes`;
    // Avenue M has one 4-hour meter and two 15-hour meters, all metered at the same times.
    expect(avenueM).toEqual([
      { days: 63, starts_at: '07:00:00', ends_at: '22:00:00', max_stay_minutes: 240, vehicle_class: 'passenger', source_text: '4HR Pas Mon-Sat 0700-2200' },
      { days: 63, starts_at: '07:00:00', ends_at: '22:00:00', max_stay_minutes: 900, vehicle_class: 'passenger', source_text: '15HR Pas Mon-Sat 0700-2200' },
    ]);
    const delancey = await sql`select 1 from facility_meter_period where facility_id = 'nyc-dot-delancey-essex'`;
    expect(delancey).toHaveLength(0);
    const [garage] = await sql`select kind, address_line, locality, official_url from facility where id = 'nyc-dot-delancey-essex'`;
    expect(garage).toEqual({
      kind: 'garage',
      address_line: '105 Essex Street',
      locality: 'Manhattan',
      official_url: 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#manhattan',
    });
  });

  it('ATT-2 builds the same active facilities whichever source runs first', async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    const active = async () => (await facilities()).filter((facility) => facility.status === 'active').map((facility) => facility.id);
    await runSource(nycMetersOffstreet, context);
    const metersOnly = await active();
    await runSource(nycFacdbDot, context);
    const metersFirst = await active();
    const withdrawn = await sql<{ id: string }[]>`select id from facility where status = 'withdrawn' order by id`;
    await resetData(sql);
    await ingestBoth();

    expect(metersOnly).toHaveLength(29);
    expect(metersFirst).toEqual(await active());
    expect(metersFirst).toHaveLength(38);
    // A facility's ID comes from its primary record. When the Facilities Database arrives second, the
    // meters' IDs that differ from its IDs are withdrawn in favour of them.
    expect(withdrawn.map((row) => row.id)).toEqual(['nyc-dot-ferry-terminal-1', 'nyc-dot-sunnyside', 'nyc-dot-white-plains-road']);
  });

  it('ING-8 withdraws a facility no source lists any more, and brings it back when it returns', async () => {
    await ingestBoth();
    const withoutRosedale = rowsWithout(fixtures.metersRows, (row) => row.parking_facility_name !== 'Rosedale');
    const context = { sql, http: fixtureHttp({ metersRows: withoutRosedale }).http, logger: testLogger().logger };

    const outcome = await runSource(nycMetersOffstreet, context);
    const [withdrawn] = await sql`select status, withdrawn_at from facility where id = 'nyc-dot-rosedale'`;
    await runSource(nycMetersOffstreet, { ...context, http: fixtureHttp().http });
    const [back] = await sql`select status, withdrawn_at from facility where id = 'nyc-dot-rosedale'`;

    expect(outcome.counts?.rowsWithdrawn).toBe(1);
    expect(withdrawn?.status).toBe('withdrawn');
    expect(withdrawn?.withdrawn_at).toBeInstanceOf(Date);
    expect(back).toEqual({ status: 'active', withdrawn_at: null });
    expect((await facilities()).filter((facility) => facility.status === 'active')).toHaveLength(38);
  });

  it.each([
    ['an empty result', '[]', 'normalize.empty'],
    ['rows that are mostly unreadable', JSON.stringify([{ status: 'Active', parking_facility_name: 'Avenue M' }]), 'normalize.invalid_record'],
    ['something that is not rows', '{"error":"query failed"}', 'normalize.unexpected_format'],
  ])('ING-10 fails on %s and changes nothing', async (_, body, errorCode) => {
    await ingestBoth();
    const before = await facilities();

    const outcome = await runSource(nycMetersOffstreet, {
      sql,
      http: fixtureHttp({ metersRows: encode(body) }).http,
      logger: testLogger().logger,
    });

    expect(outcome).toMatchObject({ status: 'failed', errorCode });
    expect(await facilities()).toEqual(before);
    expect(await sql`select 1 from facility_meter_period where facility_id = 'nyc-dot-avenue-m'`).toHaveLength(2);
  });
});
