import { describe, expect, it } from 'vitest';
import { clusterRecords, MATCH_DISTANCE_M, metersBetween } from '../src/facilities/cluster.ts';
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
