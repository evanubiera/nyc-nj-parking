import { describe, expect, it } from 'vitest';
import { normalizeNysParcels, nysParcelsParking, NYS_CANDIDATES_WHERE, publicationDate } from '../src/sources/nys-parcels-parking.ts';
import { normalizeThruway, THRUWAY_PARK_RIDE_PAGE, thruwayParkRide } from '../src/sources/thruway-park-ride.ts';
import { fixtureHttp, fixtures } from './fixtures.ts';

describe("The Thruway's commuter park-and-ride lots (S5-2)", () => {
  it('ING-2 asks data.ny.gov for the 31 lots and stores the rows as received, dated by the dataset', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await thruwayParkRide.fetch(http);

    expect(requests.map((request) => new URL(request.url).pathname)).toEqual(['/resource/nvxe-b625.json', '/api/views/nvxe-b625.json']);
    expect(new TextDecoder().decode(fetched.body)).toBe(new TextDecoder().decode(fixtures.thruwayRows));
    expect(fetched.upstreamUpdatedAt).toEqual(new Date(1733978309 * 1000));
  });

  it('ADR-0007 shows each lot with who runs it and its spaces, and leaves out the shopping centre\'s', () => {
    const { rowsRead, records, invalidRows } = normalizeThruway(fixtures.thruwayRows);
    const types: Record<string, number> = {};
    for (const record of records) types[record.operatorType] = (types[record.operatorType] ?? 0) + 1;

    expect([rowsRead, records.length, invalidRows]).toEqual([31, 30, 0]);
    expect(types).toEqual({ public_authority: 15, state: 14, transit_agency: 1 });
    expect(records.map((record) => record.name)).not.toContain('West Nyack (Lot J)'); // the Palisades Center's
    expect(records.find((record) => record.name === 'Newburgh')).toMatchObject({
      operatorName: 'New York State Department of Transportation', operatorType: 'state', spaces: 289, locality: 'Newburgh',
      addressLine: 'On Rt. 17K at Union Avenue at the Short Line Bus Station', region: 'NY', officialUrl: THRUWAY_PARK_RIDE_PAGE, confirmed: true,
    });
    expect(records.find((record) => record.name === 'Spring Valley (East Lot)')).toMatchObject({
      locality: 'Spring Valley', operatorName: 'New York State Department of Transportation and Town of Clarkstown',
    });
    // "16-hour Parking Limit" isn't where the lot is.
    expect(records.find((record) => record.name === 'Manchester')?.addressLine).toBeNull();
  });

  it('ING-10 counts a lot with an operator it doesn\'t know as a row it can\'t read', () => {
    const edited = new TextEncoder().encode(new TextDecoder().decode(fixtures.thruwayRows).replace('"Niagara Frontier Transportation Authority"', '"Someone Else"'));

    expect(normalizeThruway(edited).invalidRows).toBe(1);
  });
});

describe("New York State's public tax parcels (S5-3)", () => {
  it('ING-2 asks for publicly owned parking parcels in one query, without mailing addresses, dated by the publication', async () => {
    const { http, requests } = fixtureHttp();

    const fetched = await nysParcelsParking.fetch(http);

    const query = new URL(requests.at(-1)!.url);
    expect(query.pathname).toBe('/arcgis/rest/services/NYS_Tax_Parcels_Public/MapServer/1/query');
    expect(query.searchParams.get('where')).toBe(NYS_CANDIDATES_WHERE);
    expect(query.searchParams.get('outFields')).not.toMatch(/MAIL|ADD_OWNER/);
    expect(fetched.upstreamUpdatedAt).toEqual(new Date('2026-05-01T00:00:00Z'));
    expect(publicationDate('<P>Publication Date: March 2026. Updated annually.</P>')).toEqual(new Date('2026-03-01T00:00:00Z'));
  });

  it('ING-13 makes 650 unconfirmed sites in 171 towns from 892 parcels, touching parcels of one owner as one', () => {
    const { rowsRead, records, invalidRows } = normalizeNysParcels(fixtures.nysParcelsQuery);
    const towns: Record<string, number> = {};
    for (const record of records) towns[record.locality] = (towns[record.locality] ?? 0) + 1;

    expect([rowsRead, invalidRows]).toEqual([892, 0]);
    expect(records).toHaveLength(650);
    expect(Object.keys(towns)).toHaveLength(171);
    expect(towns).toMatchObject({ Buffalo: 78, Islip: 42, Syracuse: 25 });
    expect(new Set(records.map((record) => record.facilityKey)).size).toBe(records.length);
    expect(records.filter((record) => record.kind === 'garage')).toHaveLength(33);
    for (const record of records) expect(record).toMatchObject({ confirmed: false, operatorType: 'unknown', operatorName: null, officialUrl: null, region: 'NY', priority: 3 });
  });

  it('ADR-0022 leaves out a housing authority\'s or an industrial development agency\'s parking, and names towns plainly', () => {
    const raw = JSON.parse(new TextDecoder().decode(fixtures.nysParcelsQuery)) as { features: { attributes: Record<string, string> }[] };
    const owners = raw.features.map((feature) => feature.attributes.PRIMARY_OWNER ?? '');
    expect(owners.some((owner) => /HOUSING/i.test(owner))).toBe(true);
    const { records } = normalizeNysParcels(fixtures.nysParcelsQuery);

    expect(records.map((record) => record.locality)).toContain('Amsterdam'); // "Amsterdam, City"
    expect(records.map((record) => record.locality).some((town) => /,\s*(City|Town|Village)$/.test(town))).toBe(false);
    expect(records.length).toBeLessThan(raw.features.length);
  });
});
