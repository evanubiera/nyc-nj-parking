import { describe, expect, it } from 'vitest';
import { BERGEN, njParcelsBergenParking, normalizeCandidates } from '../src/sources/nj-parcels-parking.ts';
import { fixtureHttp, PARCELS_SERVICE_PATH } from './fixtures.ts';

async function bergen() {
  return normalizeCandidates((await njParcelsBergenParking.fetch(fixtureHttp().http)).body, BERGEN);
}

describe('Bergen County candidate sites from tax records (S4-32)', () => {
  it('ING-2 asks the parcel layer for Bergen, with the neighbours in parts', async () => {
    const { http, requests } = fixtureHttp();

    await njParcelsBergenParking.fetch(http);

    const wheres = requests.filter((request) => new URL(request.url).pathname === `${PARCELS_SERVICE_PATH}/0/query`)
      .map((request) => new URL(request.url).searchParams.get('where') ?? '');
    expect(wheres[0]).toContain("COUNTY='BERGEN' AND PROP_CLASS='15C'");
    expect(wheres.length).toBeGreaterThan(2);
    expect(wheres.slice(1).every((where) => where.includes("PCL_MUN='02"))).toBe(true);
  });

  it('ING-13 keeps sites in 35 of Bergen\'s towns, with the layer\'s abbreviated town names written out', async () => {
    const { rowsRead, records, invalidRows } = await bergen();
    const towns: Record<string, number> = {};
    for (const record of records) towns[record.locality] = (towns[record.locality] ?? 0) + 1;

    expect([rowsRead, invalidRows]).toEqual([166, 0]);
    expect(records).toHaveLength(100);
    expect(Object.keys(towns)).toHaveLength(35);
    expect(towns).toMatchObject({ Teaneck: 12, Hackensack: 10, Englewood: 8, 'Hasbrouck Heights': 1, 'River Edge': 6, 'Washington Township': 2 });
    expect(records.find((record) => record.name === '32 Bergen St')).toMatchObject({ locality: 'Englewood', facilityKey: 'englewood-site-1208-1-01', confirmed: false });
  });

  it('ADR-0019 leaves out pool and ballfield parking, "future parking", and condominium parking spaces', async () => {
    const { records } = await bergen();
    const keys = records.map((record) => record.facilityKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(towns(records)['Ridgefield Park']).toBe(1); // only 55 Webster St; the rest serve a pool, a hockey field, and Veterans Park
    expect(records.map((record) => record.name)).not.toContain('Genther Avenue'); // "future parking", Oradell
    expect(keys.filter((key) => key.startsWith('washington-township-site-2506-7'))).toEqual([]); // four deeded parking spaces
  });
});

function towns(records: { locality: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) counts[record.locality] = (counts[record.locality] ?? 0) + 1;
  return counts;
}
