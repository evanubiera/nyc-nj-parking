import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { JC_PARKING_PAGE, jcMunicipalLots, normalizeJcLots } from '../src/sources/jc-municipal-lots.ts';
import { njParcelsJcParking, normalizeCandidates } from '../src/sources/nj-parcels-jc-parking.ts';
import { fixtureHttp, fixtures, PARCELS_SERVICE_PATH } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const encode = (text: string) => new TextEncoder().encode(text);

async function ingestJc(http = fixtureHttp().http) {
  const context = { sql, http, logger: testLogger().logger };
  return [await runSource(jcMunicipalLots, context), await runSource(njParcelsJcParking, context)];
}

async function snapshotOf(source = njParcelsJcParking) {
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

describe('Jersey City candidate sites from tax records (S4-3)', () => {
  it('ING-2 makes its two queries and stores both responses together, exactly as received', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await njParcelsJcParking.fetch(http);

    const queries = requests.filter((request) => new URL(request.url).pathname === `${PARCELS_SERVICE_PATH}/0/query`);
    expect(queries).toHaveLength(2);
    expect(new URL(queries[0]!.url).searchParams.get('where')).toContain("PROP_CLASS='15C'");
    expect(new URL(queries[1]!.url).searchParams.get('where')).toContain("PROP_CLASS LIKE '15%'");
    // Owner names are redacted in the layer, and never asked for.
    expect(requests.every((request) => !/OWNER/i.test(new URL(request.url).searchParams.get('outFields') ?? ''))).toBe(true);
    const envelope = JSON.parse(new TextDecoder().decode(fetched.body)) as { candidates: string; neighbours: string };
    expect(envelope.candidates).toBe(new TextDecoder().decode(fixtures.parcelsCandidates));
    expect(envelope.neighbours).toBe(new TextDecoder().decode(fixtures.parcelsNeighbours));
    expect(fetched.upstreamUpdatedAt).toEqual(new Date(1787045558134));
  });

  it('ING-13 keeps sites with no other public use on the block, and leaves out railroad land and post office lots', async () => {
    const { rowsRead, records, invalidRows } = normalizeCandidates((await snapshotOf()).body);
    const names = records.map((record) => record.name);

    expect(rowsRead).toBe(139);
    expect(invalidRows).toBe(0);
    expect(records).toHaveLength(26);
    expect(names).toContain('179 Montgomery St.');
    expect(names).toContain('2080 West Side Ave.');
    expect(names).not.toContain('Secaucus Road'); // post office land, as its own parcels say
    expect(names).not.toContain('256 Carbon St.'); // a private right of way beside public housing
    expect(names).not.toContain('197 Bergen Ave.'); // beside a school and an administrative building
  });

  it('REC-9 marks every site unconfirmed, with no owner, operator name, or official page', async () => {
    const { records } = normalizeCandidates((await snapshotOf()).body);

    for (const record of records) {
      expect(record).toMatchObject({ confirmed: false, operatorType: 'unknown', operatorName: null, officialUrl: null, matchTokens: [], priority: 3 });
    }
    expect(records.find((record) => record.name === '179 Montgomery St.')?.facilityKey).toBe('jc-site-14102-12');
  });

  it('ING-10 fails a snapshot that is missing one of its two responses', async () => {
    expect(() => normalizeCandidates(encode(JSON.stringify({ candidates: '{"features":[]}' })))).toThrow(/missing a query response/);
  });
});

describe('both Jersey City sources together (S4-4)', () => {
  it('ING-14 merges candidate sites into the city lots within 90 m, with the city lot as the primary', async () => {
    const outcomes = await ingestJc();

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['succeeded', 'succeeded']);
    const facilities = await sql<{ id: string; name: string; confirmed: boolean; operator_type: string }[]>`
      select id, name, confirmed, operator_type from facility where status = 'active' order by id`;
    expect(facilities).toHaveLength(30);
    expect(facilities.filter((facility) => facility.confirmed)).toHaveLength(7);
    expect(facilities.filter((facility) => !facility.confirmed)).toHaveLength(23);
    const lot33 = await sql`select source_id from facility_source where facility_id = 'jc-lot-33' order by source_id`;
    expect(lot33.map((link) => link.source_id)).toEqual(['jc-municipal-lots', 'nj-parcels-jc-parking']);
    expect(facilities.find((facility) => facility.id === 'jc-lot-33')).toMatchObject({ name: 'Lot 33', confirmed: true, operator_type: 'municipal' });
  });

  it('REC-9 the database refuses an unknown operator on a confirmed facility', async () => {
    await expect(sql`
      insert into facility (id, name, kind, operator_name, operator_type, locality, region, time_zone, location,
        official_url, confirmed, first_seen_at, last_seen_at)
      values ('x', 'x', 'lot', null, 'unknown', 'Jersey City', 'NJ', 'America/New_York',
        ST_SetSRID(ST_MakePoint(-74.05, 40.72), 4326)::geography, 'https://example.test', true, now(), now())`).rejects.toThrow(/facility_unconfirmed_check/);
  });
});
