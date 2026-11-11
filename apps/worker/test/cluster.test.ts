import { describe, expect, it } from 'vitest';
import { clusterRecords, MATCH_DISTANCE_M, metersBetween, NEARBY_MATCHES } from '../src/facilities/cluster.ts';
import { matchTokens } from '../src/normalize/names.ts';
import { normalizeFacdb } from '../src/sources/nyc-facdb-dot.ts';
import { normalizeMeters } from '../src/sources/nyc-meters-offstreet.ts';
import { fixtures } from './fixtures.ts';

const facdb = normalizeFacdb(fixtures.facdbRows).records.map((record) => ({ ...record, sourceId: 'nyc-facdb-dot' }));
const meters = normalizeMeters(fixtures.metersRows).records.map((record) => ({ ...record, sourceId: 'nyc-meters-offstreet' }));
const clusters = clusterRecords([...meters, ...facdb]);
const byId = new Map(clusters.map((cluster) => [cluster.facilityId, cluster]));

describe('matching facilities across sources (S1-5)', () => {
  it('ATT-2 makes one facility per field, from 35 Facilities Database rows and 29 meter groups', () => {
    expect(facdb).toHaveLength(35);
    // 30 field names in the meters; "Gowanus" and "Gowanus Parking Field" are one field.
    expect(meters).toHaveLength(29);
    expect(clusters).toHaveLength(38);
  });

  it('ATT-2 links a field in both sources to one facility, named from the Facilities Database', () => {
    const avenueM = byId.get('nyc-dot-avenue-m')!;

    expect(avenueM.members.map((member) => member.sourceId).sort()).toEqual(['nyc-facdb-dot', 'nyc-meters-offstreet']);
    expect(avenueM.primary.sourceId).toBe('nyc-facdb-dot');
    expect(avenueM.primary.name).toBe('Avenue M Municipal Parking Field');
  });

  it('ATT-2 matches fields whose meters sit far from the listed point, up to the limit', () => {
    const gowanus = byId.get('nyc-dot-gowanus')!;
    const ferry = byId.get('nyc-dot-ferry-terminal-south-1')!;

    expect(gowanus.members).toHaveLength(2);
    expect(ferry.members).toHaveLength(2);
    expect(metersBetween(gowanus.members[0]!, gowanus.members[1]!)).toBeGreaterThan(150);
    expect(metersBetween(gowanus.members[0]!, gowanus.members[1]!)).toBeLessThan(MATCH_DISTANCE_M);
  });

  it('ATT-2 keeps nearby fields with different numbers apart', () => {
    const ditmars1 = byId.get('nyc-dot-ditmars-1')!;
    const ditmars2 = byId.get('nyc-dot-ditmars-2')!;

    expect(metersBetween(ditmars1.primary, ditmars2.primary)).toBeLessThan(150);
    expect(ditmars1.members.map((member) => member.recordId)).not.toContain('ditmars-2');
    expect(ditmars2.members.map((member) => member.recordId)).toContain('ditmars-2');
  });

  it('ATT-2 keeps fields that only the meters list as their own facilities', () => {
    for (const id of ['nyc-dot-meeker-avenue', 'nyc-dot-rosedale', 'nyc-dot-west-brighton-avenue']) {
      expect(byId.get(id)?.members.map((member) => member.sourceId)).toEqual(['nyc-meters-offstreet']);
    }
  });

  it('ATT-2 never puts two records from one source in the same facility', () => {
    for (const cluster of clusters) {
      const sources = cluster.members.map((member) => member.sourceId);
      expect(new Set(sources).size).toBe(sources.length);
    }
  });

  it('gives the same result whatever order the records arrive in', () => {
    const reversed = clusterRecords([...facdb, ...meters].reverse());

    expect(reversed.map((cluster) => cluster.facilityId).sort()).toEqual(clusters.map((cluster) => cluster.facilityId).sort());
  });
});

describe('matching NJ lots (S2-6)', () => {
  const record = (sourceId: string, recordId: string, name: string, lat: number, lng: number, region = 'NJ') => ({
    sourceId,
    recordId,
    facilityKey: `${sourceId}-${recordId}`,
    priority: sourceId === 'njdot-park-ride' ? 3 : sourceId === 'njt-parking-lots' ? 2 : 1,
    matchTokens: matchTokens(name),
    region,
    lat,
    lng,
  });
  // About 25 m apart, like "Fairlawn DPW" and "Fair Lawn Commuter Parking Lot" on 2026-11-03.
  const fairlawn = record('njt-parking-lots', 'rail/Fairlawn DPW_01', 'Fairlawn DPW', 40.94043, -74.13137);
  const fairLawnDot = record('njdot-park-ride', '1', 'Fair Lawn Commuter Parking Lot', 40.94063, -74.13125);

  it('ING-12 matches NJ Transit and NJDOT lots within 100 m, whatever their names', () => {
    const [cluster, ...rest] = clusterRecords([fairLawnDot, fairlawn]);

    expect(rest).toHaveLength(0);
    expect(cluster?.primary.sourceId).toBe('njt-parking-lots');
    expect(metersBetween(fairlawn, fairLawnDot)).toBeLessThan(NEARBY_MATCHES[0]!.meters);
  });

  it('ING-12 keeps NJ Transit and NJDOT lots with different names apart beyond 100 m', () => {
    const farther = { ...fairLawnDot, lat: fairLawnDot.lat + 0.002 }; // about 220 m north

    expect(clusterRecords([fairlawn, farther])).toHaveLength(2);
  });

  it('ING-12 matches by distance alone only for that pair of sources', () => {
    const facdb = record('nyc-facdb-dot', 'a', 'Ditmars No. 1', 40.77, -73.91, 'NY');
    const meters = record('nyc-meters-offstreet', 'b', 'Steinway No. 2', 40.7701, -73.91, 'NY');

    expect(clusterRecords([facdb, meters])).toHaveLength(2);
  });

  it('ING-12 never matches records in different regions, even with the same name', () => {
    const statenIsland = record('nyc-facdb-dot', 'a', 'Elizabeth', 40.6371, -74.1951, 'NY');
    const acrossTheKill = record('njt-parking-lots', 'b', 'Elizabeth', 40.6366, -74.1985);

    expect(metersBetween(statenIsland, acrossTheKill)).toBeLessThan(MATCH_DISTANCE_M);
    expect(clusterRecords([statenIsland, acrossTheKill])).toHaveLength(2);
  });
});

describe('a lot and a tax-record site (S4-43)', () => {
  it('ING-14 makes the lot the primary even when the site has the same priority and comes first by name', () => {
    // Clinton Point, NJDOT's park-and-ride, 23 m from the site at 194 Center Street (2026-11-10). Both priority 3.
    const lot = { sourceId: 'njdot-park-ride', recordId: '9', facilityKey: 'njdot-clinton-point', priority: 3, matchTokens: matchTokens('Clinton Point'), region: 'NJ', lat: 40.6391, lng: -74.8943 };
    const site = { sourceId: 'nj-parcels-rest-of-nj-parking', recordId: '1006_76_3', facilityKey: 'clinton-township-site-76-3', priority: 3, confirmed: false, matchTokens: [], region: 'NJ', lat: 40.6393, lng: -74.8941 };

    const [cluster, ...rest] = clusterRecords([site, lot]);

    expect(rest).toHaveLength(0);
    expect(cluster?.primary.sourceId).toBe('njdot-park-ride');
    expect(cluster?.facilityId).toBe('njdot-clinton-point');
  });
});
