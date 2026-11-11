import { connectTest, resetData } from '@parking/db/testing';
import { afterAll, beforeEach, describe, expect, inject, it } from 'vitest';
import { runSource } from '../src/run.ts';
import { njdotParkRide, normalizeNjdot } from '../src/sources/njdot-park-ride.ts';
import { njtParkingLots, normalizeNjt, officialUrl } from '../src/sources/njt-parking-lots.ts';
import { NJT_PARKING_PAGE } from '../src/sources/nj.ts';
import { featuresEdited, fixtureHttp, fixtures, NJT_SERVICE_PATH } from './fixtures.ts';
import { testLogger } from './support.ts';

const sql = connectTest(inject('testDatabase'));
afterAll(() => sql.end());
beforeEach(() => resetData(sql));

const encode = (text: string) => new TextEncoder().encode(text);
const njt = normalizeNjt(fixtures.njtQuery);
const njtRecord = (recordId: string) => njt.records.find((record) => record.recordId === recordId)!;
const published = njt.records.filter((record) => record.withheldReason === null);

async function ingestNj(http = fixtureHttp().http) {
  const context = { sql, http, logger: testLogger().logger };
  return [await runSource(njtParkingLots, context), await runSource(njdotParkRide, context)];
}

async function activeFacilities() {
  return sql<{ id: string; name: string; operator_type: string; lot_number: string | null }[]>`
    select id, name, operator_type, lot_number from facility where status = 'active' order by id`;
}

describe('ArcGIS fetching (S2-3)', () => {
  it('ING-5 goes from the item to its one layer, and asks only for the fields it uses', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await njtParkingLots.fetch(http);

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual([
      '/sharing/rest/content/items/2f311895a644453f8f679479187aa19e',
      NJT_SERVICE_PATH,
      `${NJT_SERVICE_PATH}/24`,
      `${NJT_SERVICE_PATH}/24/query`,
    ]);
    const query = new URL(requests[3]!.url).searchParams;
    expect(query.get('where')).toBe('1=1');
    expect(query.get('returnCentroid')).toBe('true');
    expect(query.get('returnGeometry')).toBe('false');
    expect(query.get('outSR')).toBe('4326');
    // Contact names and phone numbers are never requested, so they're never stored.
    expect(query.get('outFields')).not.toMatch(/contac|pubcontact/i);
    expect(requests.every((request) => request.headers.get('x-app-token') === null)).toBe(true);
    expect(fetched.upstreamUpdatedAt).toEqual(new Date(1791484028341));
    expect(fetched.body).toEqual(fixtures.njtQuery);
  });

  it('ING-2 fails a response that was cut short rather than keep part of it', async () => {
    const cutShort = encode(JSON.stringify({ exceededTransferLimit: true, features: [] }));

    const outcome = await runSource(njtParkingLots, { sql, http: fixtureHttp({ njtQuery: cutShort }).http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'upstream.too_large' });
  });

  it.each([
    ['the query answers with an error', { njtQuery: encode('{"error":{"code":400,"message":"Invalid query"}}') }, 'upstream.http_status'],
    ['the item has no service URL', { njtItem: encode('{"id":"2f311895a644453f8f679479187aa19e"}') }, 'normalize.unexpected_format'],
    ['the service has two layers', { njtService: encode('{"layers":[{"id":1},{"id":2}]}') }, 'normalize.unexpected_format'],
  ])('ING-3 fails when %s, and changes nothing', async (_, overrides, errorCode) => {
    await ingestNj();
    const before = await activeFacilities();

    const outcome = await runSource(njtParkingLots, { sql, http: fixtureHttp(overrides).http, logger: testLogger().logger });

    expect(outcome).toMatchObject({ status: 'failed', errorCode });
    expect(await activeFacilities()).toEqual(before);
  });
});

describe('NJ Transit parking lots (S2-4)', () => {
  it('ING-11 leaves out the test row, closed lots, entries with no spaces, and lots with no owner', () => {
    expect(njt.rowsRead).toBe(511);
    expect(njt.invalidRows).toBe(0);
    // 511 rows: 1 test row, 2 not active, 60 with 0 spaces, and 17 with no owner left out.
    expect(njt.records).toHaveLength(431);
    expect(published).toHaveLength(399);
    expect(njt.records.some((record) => record.name === 'test')).toBe(false);
    expect(njt.records.some((record) => record.name === 'New York Penn Station')).toBe(false);
  });

  it('ING-11 keeps lots owned privately or in part privately as withheld', () => {
    const withheld = njt.records.filter((record) => record.withheldReason === 'private_owner');

    expect(withheld).toHaveLength(32);
    expect(njtRecord('rail/Morristown_03').withheldReason).toBe('private_owner'); // "NJ Transit/Private"
    expect(njtRecord('rail/Princeton_01').withheldReason).toBe('private_owner'); // "Municipal/Private"
  });

  it('ADR-0007 maps each owner to an operator name and type', () => {
    expect(njtRecord('rail/Bay Street_01')).toMatchObject({ operatorName: 'Montclair Township', operatorType: 'municipal' });
    expect(njtRecord('rail/Annandale_01')).toMatchObject({ operatorName: 'NJ Transit', operatorType: 'transit_agency' }); // shared with the town
    expect(njtRecord('bus/Vince Lombardi_01')).toMatchObject({ operatorName: 'New Jersey Turnpike Authority', operatorType: 'public_authority' });
    expect(njtRecord('bus/North Bergen_01')).toMatchObject({ operatorName: 'Port Authority of New York and New Jersey', operatorType: 'public_authority' });
    expect(njt.records.filter((record) => record.operatorType === 'county').map((record) => record.operatorName).sort()).toEqual([
      'Essex County',
      'Orange County',
      'Somerset County',
    ]);
    const types = new Map<string, number>();
    for (const record of published) types.set(record.operatorType, (types.get(record.operatorType) ?? 0) + 1);
    expect(Object.fromEntries(types)).toEqual({ municipal: 189, transit_agency: 197, public_authority: 7, state: 3, county: 3 });
  });

  it('ING-10 counts a row with an owner it doesn\'t know as unreadable, and fails when those outnumber the rest', async () => {
    const oneUnknown = featuresEdited(fixtures.njtQuery, (row) => (row.facilityid === 'Bay Street_01' ? { ...row, lotowner: 'Somebody New' } : row));
    const allUnknown = featuresEdited(fixtures.njtQuery, (row) => ({ ...row, lotowner: 'Somebody New' }));

    expect(normalizeNjt(oneUnknown).invalidRows).toBe(1);
    const outcome = await runSource(njtParkingLots, { sql, http: fixtureHttp({ njtQuery: allUnknown }).http, logger: testLogger().logger });
    expect(outcome).toMatchObject({ status: 'failed', errorCode: 'normalize.invalid_record' });
  });

  it('REC-8 numbers lots only where several share a name, without leading zeros', () => {
    expect(njtRecord('rail/Morristown_01').lotNumber).toBe('1');
    expect(njtRecord('rail/Morristown_02').lotNumber).toBe('2');
    expect(njtRecord('rail/Suffern_R').lotNumber).toBe('R');
    expect(njtRecord('rail/Bay Street_01').lotNumber).toBeNull();
    expect(published.filter((record) => record.lotNumber !== null)).toHaveLength(284);
  });

  it('places each lot at the centre of its outline, not at its lat and long fields', () => {
    const features = (JSON.parse(new TextDecoder().decode(fixtures.njtQuery)) as {
      features: { attributes: { facilityid: string; lotuse: string }; centroid: { x: number; y: number } }[];
    }).features;
    for (const record of njt.records) {
      const feature = features.find((f) => `${f.attributes.lotuse.toLowerCase().replace(/ /g, '-')}/${f.attributes.facilityid}` === record.recordId)!;
      expect({ lat: record.lat, lng: record.lng }).toEqual({ lat: feature.centroid.y, lng: feature.centroid.x });
    }
  });

  it('puts the lots in Rockland and Orange counties in NY, and the rest in NJ', () => {
    expect(njtRecord('rail/Suffern_R')).toMatchObject({ region: 'NY', locality: 'Ramapo' }); // "Ramapo Town, NY" (S5-3)
    expect(njt.records.filter((record) => record.region === 'NY')).toHaveLength(8);
  });

  it('ATT-2 links to the lot\'s own site, or to NJ Transit\'s Parking page', () => {
    expect(njtRecord('rail/Bay Street_01').officialUrl).toBe('https://www.montclairnjusa.org/');
    expect(njtRecord('rail/Annandale_01').officialUrl).toBe(NJT_PARKING_PAGE);
    expect(officialUrl('https://www.njtransit.com')).toBe(NJT_PARKING_PAGE);
    expect(officialUrl('www.example.org')).toBe(NJT_PARKING_PAGE);
    expect(officialUrl(null)).toBe(NJT_PARKING_PAGE);
  });
});

describe('NJDOT park and ride (S2-5)', () => {
  const njdot = normalizeNjdot(fixtures.njdotQuery);

  it('keeps one of two lots listed under one name, the lower OBJECTID', () => {
    expect(njdot.rowsRead).toBe(17);
    expect(njdot.invalidRows).toBe(0);
    expect(njdot.records).toHaveLength(16);
    expect(njdot.records.filter((record) => record.name.startsWith('Mount Arlington')).map((record) => record.recordId)).toEqual(['11']);
  });

  it('ADR-0007 labels every lot as NJDOT\'s, with its town named as the rest of the app names it (S4-44)', () => {
    expect(njdot.records.every((record) => record.operatorType === 'state' && record.operatorName === 'New Jersey Department of Transportation')).toBe(true);
    expect(njdot.records.find((record) => record.recordId === '2')).toMatchObject({ name: 'Montville', locality: 'Montville' }); // "Montville Twp"
    expect(njdot.records.find((record) => record.recordId === '3')?.name).toBe('Ross Corner');
  });
});

describe('both NJ sources together (S2-6)', () => {
  it('ING-12 merges NJDOT lots into the NJ Transit lots within 100 m, with NJ Transit\'s record as the primary', async () => {
    const outcomes = await ingestNj();

    expect(outcomes.map((outcome) => outcome.status)).toEqual(['succeeded', 'succeeded']);
    const active = await activeFacilities();
    expect(active).toHaveLength(411); // 399 NJ Transit lots and 12 NJDOT lots of their own
    const links = await sql`select source_id from facility_source where facility_id = 'njt-fairlawn-dpw-01' order by source_id`;
    expect(links.map((link) => link.source_id)).toEqual(['njdot-park-ride', 'njt-parking-lots']);
    expect(active.find((facility) => facility.id === 'njt-fairlawn-dpw-01')).toMatchObject({ name: 'Fairlawn DPW', operator_type: 'municipal' });
    expect(active.filter((facility) => facility.id.startsWith('njdot-'))).toHaveLength(12);
  });

  it('ING-11 hides a lot NJ Transit records as private, even though NJDOT lists it', async () => {
    await ingestNj();

    const beverwyck = await sql`select id from facility where name ilike '%beverwyck%'`;
    expect(beverwyck).toHaveLength(0);
    const records = await sql`select source_id, withheld_reason from source_record where name ilike '%beverwyck%' order by source_id`;
    expect(records).toEqual([
      { source_id: 'njdot-park-ride', withheld_reason: null },
      { source_id: 'njt-parking-lots', withheld_reason: 'private_owner' },
    ]);
  });

  it('ING-11 withdraws a published lot whose owner becomes private', async () => {
    await ingestNj();
    const nowPrivate = featuresEdited(fixtures.njtQuery, (row) => (row.facilityid === 'Bay Street_01' ? { ...row, lotowner: 'Private' } : row));

    await runSource(njtParkingLots, { sql, http: fixtureHttp({ njtQuery: nowPrivate }).http, logger: testLogger().logger });

    const [bayStreet] = await sql`select status from facility where id = 'njt-bay-street-01'`;
    expect(bayStreet?.status).toBe('withdrawn');
  });

  it('REC-8 stores lot numbers on the facilities', async () => {
    await ingestNj();

    const morristown = (await activeFacilities()).filter((facility) => facility.name === 'Morristown');
    expect(morristown.map((facility) => [facility.id, facility.lot_number])).toEqual([
      ['njt-morristown-01', '1'],
      ['njt-morristown-02', '2'],
    ]);
  });
});
