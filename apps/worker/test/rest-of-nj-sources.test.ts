import { describe, expect, it } from 'vitest';
import { BERGEN, njParcelsRestOfNjParking, normalizeCandidates, REST_OF_NJ } from '../src/sources/nj-parcels-parking.ts';
import { REST_OF_NJ_TOWNS } from '../src/sources/nj-towns.ts';
import { fixtureHttp, PARCELS_SERVICE_PATH } from './fixtures.ts';

let saved: Awaited<ReturnType<typeof njParcelsRestOfNjParking.fetch>> | undefined;
async function restOfNj() {
  saved ??= await njParcelsRestOfNjParking.fetch(fixtureHttp().http);
  return normalizeCandidates(saved.body, REST_OF_NJ);
}

describe('The rest of New Jersey: candidate sites from tax records (S4-37)', () => {
  it('ING-2 asks for each of the 18 counties in its own query, then the neighbours in parts, and stores every response', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await njParcelsRestOfNjParking.fetch(http);

    const wheres = requests.filter((request) => new URL(request.url).pathname === `${PARCELS_SERVICE_PATH}/0/query`)
      .map((request) => new URL(request.url).searchParams.get('where') ?? '');
    const counties = wheres.filter((where) => where.includes("PROP_CLASS='15C'")).map((where) => /COUNTY='([A-Z ]+)'/.exec(where)?.[1]);
    expect(counties).toEqual(['ATLANTIC', 'BURLINGTON', 'CAMDEN', 'CAPE MAY', 'CUMBERLAND', 'GLOUCESTER', 'HUNTERDON', 'MERCER',
      'MIDDLESEX', 'MONMOUTH', 'MORRIS', 'OCEAN', 'PASSAIC', 'SALEM', 'SOMERSET', 'SUSSEX', 'UNION', 'WARREN']);
    expect(wheres.length - counties.length).toBeGreaterThan(10);
    expect(requests.every((request) => request.url.length <= 1_800)).toBe(true);
    const envelope = JSON.parse(new TextDecoder().decode(fetched.body)) as { candidates: string[]; neighbours: string[] };
    expect(envelope.candidates).toHaveLength(18);
  });

  it('ING-13 keeps 708 sites in 212 towns, each with a facility ID of its own', async () => {
    const { rowsRead, records, invalidRows } = await restOfNj();
    const towns: Record<string, number> = {};
    for (const record of records) towns[record.locality] = (towns[record.locality] ?? 0) + 1;

    expect([rowsRead, invalidRows]).toEqual([1858, 0]);
    expect(records).toHaveLength(708);
    expect(Object.keys(towns)).toHaveLength(212);
    expect(new Set(records.map((record) => record.facilityKey)).size).toBe(records.length);
    expect(towns).toMatchObject({ Trenton: 48, Camden: 27, Vineland: 23, Paterson: 17, 'Long Branch': 12 });
    for (const record of records) expect(record).toMatchObject({ confirmed: false, operatorType: 'unknown', operatorName: null, region: 'NJ' });
  });

  it('ADR-0020 names towns as people say them, and keeps IDs apart where names repeat across counties', async () => {
    const { records } = await restOfNj();
    const keys = records.map((record) => record.facilityKey);

    expect(REST_OF_NJ_TOWNS.MORRIS?.['1430']?.name).toBe('Long Hill'); // "Township of Long Hill"
    expect(REST_OF_NJ_TOWNS.ATLANTIC?.['0102']?.name).toBe('Atlantic City');
    expect(REST_OF_NJ_TOWNS['CAPE MAY']?.['0505']?.name).toBe('Lower Township');
    expect(REST_OF_NJ_TOWNS.CAMDEN?.['0408']?.name).toBe('Camden');
    expect(keys.some((key) => key.startsWith('hamilton-township-atlantic-site-'))).toBe(true);
    expect(keys.some((key) => key.startsWith('hamilton-township-mercer-site-'))).toBe(true);
    // Bergen's Washington Township keeps its IDs; the other counties' carry their county.
    expect(BERGEN.towns['0266']?.key).toBe('washington-township');
    expect(keys.filter((key) => key.startsWith('washington-township-site-'))).toEqual([]);
  });

  it('ADR-0020 leaves out parking that serves another use on its own parcel, a field or tennis court, or a church', async () => {
    const names = (await restOfNj()).records.map((record) => `${record.locality}: ${record.name}`);

    for (const left of [
      'Stone Harbor: 200 96th St', // "WATER WORKS PARKING"
      'Highland Park: Mccallum Pl.', // "SQUAD PARKNG LOT"
      'West Windsor: 125 Hightstown Rd', // "PARKING/TENNIS"
      'South Amboy: David St', // "RESIDENCE"
      'Elizabeth: 511-519 S Park St', // "LIBERTY BAPTIST"
      'Glassboro: 2 Paddock Dr', // "ROBINSON FIELD"
    ]) expect(names).not.toContain(left);
  });

  it('ADR-0020 keeps a downtown or beach lot beside a pump station, a rescue squad, or Green Acres land', async () => {
    const names = (await restOfNj()).records.map((record) => `${record.locality}: ${record.name}`);

    for (const kept of ['Toms River: 48 West Water Street', 'Chatham Borough: 28 Center St', 'Long Branch: 22 Ocean Ave No', 'Madison: Prospect St']) {
      expect(names).toContain(kept);
    }
  });

  it('ING-10 still reads a snapshot stored before ADR-0020, with one county\'s candidates as a string', async () => {
    await restOfNj();
    const envelope = JSON.parse(new TextDecoder().decode(saved!.body)) as { candidates: string[]; neighbours: string[] };
    const old = new TextEncoder().encode(JSON.stringify({ candidates: envelope.candidates[0], neighbours: envelope.neighbours }));

    expect(normalizeCandidates(old, REST_OF_NJ).records.every((record) => record.recordId.startsWith('01'))).toBe(true);
  });
});
