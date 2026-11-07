import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { TransactionSql } from '@parking/db';
import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { applyNormalized } from '../src/facilities/apply.ts';
import { runSource } from '../src/run.ts';
import { hobokenGarages } from '../src/sources/hoboken-garages.ts';
import { JC_PARKING_PAGE, jcMunicipalLots, normalizeJcLots } from '../src/sources/jc-municipal-lots.ts';
import { njParcelsHudsonParking, normalizeCandidates, SAYS_PARKING } from '../src/sources/nj-parcels-hudson-parking.ts';
import type { StoredSnapshot } from '../src/sources/types.ts';
import { wnyParkingLots } from '../src/sources/wny-parking-lots.ts';
import { fixtureHttp, fixtures, neighboursFor, PARCELS_SERVICE_PATH } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const MIGRATION_0006 = fileURLToPath(new URL('../../../packages/db/migrations/0006_hudson_parcels.sql', import.meta.url));
const encode = (text: string) => new TextEncoder().encode(text);
const decode = (body: Uint8Array) => new TextDecoder().decode(body);

async function ingestHudson(http = fixtureHttp().http) {
  const context = { sql, http, logger: testLogger().logger };
  const outcomes = [];
  for (const source of [jcMunicipalLots, njParcelsHudsonParking, wnyParkingLots, hobokenGarages]) outcomes.push(await runSource(source, context));
  return outcomes;
}

async function snapshotOf(source = njParcelsHudsonParking) {
  return source.fetch(fixtureHttp().http);
}

describe('Jersey City municipal lots (S4-2)', () => {
  it('ING-5 reads the portal\'s records and the dataset\'s data date', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await jcMunicipalLots.fetch(http);

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/api/explore/v2.1/catalog/datasets/municipal-parking-lots/records',
      '/api/explore/v2.1/catalog/datasets/municipal-parking-lots',
    ]);
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2020-11-25T17:23:02Z'));
    expect(fetched.body).toEqual(fixtures.jcLotsRecords);
  });

  it('ING-2 fails a response that holds fewer records than the dataset has', async () => {
    const short = encode(JSON.stringify({ total_count: 120, results: [] }));

    const outcome = await runSource(jcMunicipalLots, { sql, http: fixtureHttp({ jcLotsRecords: short }).http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'upstream.too_large' });
  });

  it('ADR-0012 gives each of the 7 lots the city as operator and its Parking page, with no hours, rates, or spaces', () => {
    const { records, invalidRows } = normalizeJcLots(fixtures.jcLotsRecords);

    expect(invalidRows).toBe(0);
    expect(records.map((record) => record.name).sort()).toEqual(['Lot 15', 'Lot 3', 'Lot 33', 'Lot 39', 'Lot 44', 'Lot 49', 'Lot 52']);
    expect(records.find((record) => record.name === 'Lot 52')).toMatchObject({
      facilityKey: 'jc-lot-52',
      addressLine: '174 Newark Ave',
      operatorName: 'City of Jersey City',
      operatorType: 'municipal',
      officialUrl: JC_PARKING_PAGE,
      confirmed: true,
      spaces: null,
      meterPeriods: [],
    });
  });
});

describe('Hudson County candidate sites from tax records (S4-3, S4-14)', () => {
  it('ING-2 makes its queries and stores every response together, exactly as received', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await njParcelsHudsonParking.fetch(http);

    const queries = requests.filter((request) => new URL(request.url).pathname === `${PARCELS_SERVICE_PATH}/0/query`);
    const wheres = queries.map((request) => new URL(request.url).searchParams.get('where') ?? '');
    expect(wheres[0]).toContain("COUNTY='HUDSON' AND PROP_CLASS='15C'");
    // The neighbours on the candidates' blocks, in parts short enough for the layer to answer (it refuses long URLs).
    expect(wheres.slice(1).length).toBeGreaterThan(1);
    for (const where of wheres.slice(1)) expect(where).toMatch(/^PROP_CLASS LIKE '15%' AND \(\(PCL_MUN='09\d\d' AND PCLBLOCK IN /);
    expect(queries.every((request) => request.url.length <= 1_800)).toBe(true);
    // Owner names are redacted in the layer, and never asked for.
    expect(requests.every((request) => !/OWNER/i.test(new URL(request.url).searchParams.get('outFields') ?? ''))).toBe(true);
    const envelope = JSON.parse(decode(fetched.body)) as { candidates: string; neighbours: string[] };
    expect(envelope.candidates).toBe(decode(fixtures.parcelsCandidates));
    expect(envelope.neighbours).toEqual(wheres.slice(1).map((where) => decode(neighboursFor(fixtures.parcelsNeighbours, where))));
    expect(fetched.upstreamUpdatedAt).toEqual(new Date(1787045558134));
  });

  it("ING-13 reads each town's wording for parking, and not a bare garage or a park", () => {
    for (const wording of ['PARKING AREA', 'PRKNG LOT 23PS', 'MUNICIPAL PKG.', 'GARAGE#B-810 PS', '5B-G-312 PS', 'MUNI PARK LOT', 'PAVED LOT', 'PARK LOT']) {
      expect(SAYS_PARKING.test(wording), wording).toBe(true);
    }
    for (const wording of ['GARAGE', 'PUBLIC WORKS GARAGE', 'PARK', 'LINCOLN PARK', 'VACANT LAND', 'P.S. 22']) {
      expect(SAYS_PARKING.test(wording), wording).toBe(false);
    }
  });

  it('ING-13 keeps sites with no other public use on the block, in every Hudson County town', async () => {
    const { rowsRead, records, invalidRows } = normalizeCandidates((await snapshotOf()).body);
    const names = records.map((record) => record.name);
    const towns: Record<string, number> = {};
    for (const record of records) towns[record.locality] = (towns[record.locality] ?? 0) + 1;

    expect(rowsRead).toBe(250);
    expect(invalidRows).toBe(0);
    expect(records).toHaveLength(53);
    // East Newark's 2 sites, Guttenberg's 1, and 2 of North Bergen's are left out as not for visitors (ADR-0017).
    expect(towns).toEqual({
      Bayonne: 6, Harrison: 3, Hoboken: 6, 'Jersey City': 24,
      'North Bergen': 3, Secaucus: 1, 'Union City': 4, Weehawken: 1, 'West New York': 5,
    });
    expect(names).toContain('179 Montgomery St.');
    expect(names).toContain('2080 West Side Ave.');
    expect(names).toContain('259 11th/ 1033 Willow Ave'); // "PRKNG LOT 23PS" in Hoboken
    expect(names).toContain('5717 Madison St'); // "PKG AUTHORITY" in West New York
    expect(names).not.toContain('127 71st St'); // Guttenberg's reserved town lot (ADR-0017)
    expect(names).not.toContain('1314 14th St'); // a North Bergen Parking Authority rental lot
    expect(names).not.toContain('Secaucus Road'); // post office land, as its own parcels say
    expect(names).not.toContain('256 Carbon St.'); // a private right of way beside public housing
    expect(names).not.toContain('197 Bergen Ave.'); // beside a school and an administrative building
    expect(names).not.toContain('Hoboken Ave.'); // beside a playground and a maintenance building
    expect(names).not.toContain('600 Essex St'); // Harrison's water department offices and parking
  });

  it('REC-9 marks every site unconfirmed, with no owner, operator name, or official page; IDs start with the town', async () => {
    const { records } = normalizeCandidates((await snapshotOf()).body);

    for (const record of records) {
      expect(record).toMatchObject({ confirmed: false, operatorType: 'unknown', operatorName: null, officialUrl: null, matchTokens: [], priority: 3 });
    }
    const keyOf = (name: string) => records.find((record) => record.name === name)?.facilityKey;
    expect(keyOf('179 Montgomery St.')).toBe('jc-site-14102-12');
    expect(keyOf('19 E 33rd St')).toBe('bayonne-site-140-5-01');
    expect(keyOf('5500 Hudson Ave')).toBe('wny-site-76-1');
    expect(records.find((record) => record.name === '506-18 38th St')).toMatchObject({ kind: 'garage', locality: 'Union City' });
  });

  it('ING-10 fails a snapshot that is missing its responses', async () => {
    expect(() => normalizeCandidates(encode(JSON.stringify({ candidates: '{"features":[]}' })))).toThrow(/missing a query response/);
    expect(() => normalizeCandidates(encode(JSON.stringify({ candidates: '{"features":[]}', neighbours: '{"features":[]}' })))).toThrow(/missing a query response/);
  });
});

describe("Hudson County's sources together (S4-4, S4-14)", () => {
  it('ING-14 merges candidate sites into the lots from towns\' own lists, with the town\'s lot as the primary', async () => {
    const outcomes = await ingestHudson();

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['succeeded', 'succeeded', 'succeeded', 'succeeded']);
    const facilities = await sql<{ id: string; name: string; confirmed: boolean; operator_type: string; locality: string }[]>`
      select id, name, confirmed, operator_type, locality from facility where status = 'active' order by id`;
    expect(facilities.filter((facility) => facility.confirmed)).toHaveLength(7 + 9 + 3);
    expect(facilities.filter((facility) => !facility.confirmed)).toHaveLength(21 + 6 + 18);
    const sourcesOf = async (id: string) =>
      (await sql`select source_id from facility_source where facility_id = ${id} order by source_id`).map((link) => link.source_id);
    expect(await sourcesOf('jc-lot-33')).toEqual(['jc-municipal-lots', 'nj-parcels-hudson-parking']);
    expect(facilities.find((facility) => facility.id === 'jc-lot-33')).toMatchObject({ name: 'Lot 33', confirmed: true, operator_type: 'municipal' });
    // All five West New York sites are its own lots; the 55th Street lot's site is 30 m from where we placed it.
    expect(facilities.filter((facility) => facility.id.startsWith('wny-site-'))).toEqual([]);
    expect(await sourcesOf('wny-55th-street-parking-lot')).toEqual(['nj-parcels-hudson-parking', 'wny-parking-lots']);
    // 221 River St is 91 m from Garage D, too far to be it.
    expect(await sourcesOf('hoboken-garage-d')).toEqual(['hoboken-garages']);
    expect(facilities.find((facility) => facility.id === 'hoboken-site-231-03-1-01')).toMatchObject({ confirmed: false, locality: 'Hoboken' });
  });

  it("ADR-0015 migration 0006 removes Jersey City's old source; its sites come back under the new one with the same IDs", async () => {
    const context = { sql, http: fixtureHttp().http, logger: testLogger().logger };
    // The old source, as it was: the same layer, under its old ID.
    const oldSource = {
      ...njParcelsHudsonParking,
      id: 'nj-parcels-jc-parking',
      apply: (tx: TransactionSql, snapshot: StoredSnapshot) =>
        applyNormalized(tx, 'nj-parcels-jc-parking', normalizeCandidates(snapshot.body), snapshot.fetchedAt),
    };
    await runSource(jcMunicipalLots, context);
    await runSource(oldSource, context);

    await sql.unsafe(readFileSync(MIGRATION_0006, 'utf8'));

    for (const table of ['source_record', 'ingestion_run', 'source_snapshot']) {
      expect(await sql`select 1 from ${sql(table)} where source_id = 'nj-parcels-jc-parking'`).toHaveLength(0);
    }
    expect(await sql`select 1 from source where id = 'nj-parcels-jc-parking'`).toHaveLength(0);
    const statusOf = async (id: string) => (await sql`select status from facility where id = ${id}`)[0]?.status;
    expect(await statusOf('jc-site-14102-12')).toBe('withdrawn');
    expect(await statusOf('jc-lot-33')).toBe('active');

    await runSource(njParcelsHudsonParking, context);

    expect(await statusOf('jc-site-14102-12')).toBe('active');
  });

  it('REC-9 the database refuses an unknown operator on a confirmed facility', async () => {
    await expect(sql`
      insert into facility (id, name, kind, operator_name, operator_type, locality, region, time_zone, location,
        official_url, confirmed, first_seen_at, last_seen_at)
      values ('x', 'x', 'lot', null, 'unknown', 'Jersey City', 'NJ', 'America/New_York',
        ST_SetSRID(ST_MakePoint(-74.05, 40.72), 4326)::geography, 'https://example.test', true, now(), now())`).rejects.toThrow(/facility_unconfirmed_check/);
  });
});
