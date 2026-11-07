// S1-5 and S2-6: groups source records that describe the same facility. Two records are the same facility
// when they come from different sources in the same region, and either their names match (names.ts) within
// MATCH_DISTANCE_M, or they come from a pair of sources in NEARBY_MATCHES and are within its distance.
// Checked against the sources on 2026-11-03: correct name matches were up to 497 m apart (the Gowanus field
// runs for blocks), so the limit is 750 m and the name has to match.
import { namesMatch } from '../normalize/names.ts';

export const MATCH_DISTANCE_M = 750;

/**
 * ING-12: sources that name the same lot differently, so nearness alone is enough. NJ Transit and NJDOT
 * lots that are the same were 6 to 25 m apart on 2026-11-03 ("Fairlawn DPW" and "Fair Lawn Commuter
 * Parking Lot"); the nearest different lots were over 380 m apart.
 */
export const NEARBY_MATCHES: readonly { sources: readonly [string, string]; meters: number }[] = [
  { sources: ['njt-parking-lots', 'njdot-park-ride'], meters: 100 },
  // ING-14: a candidate site from tax records is named by its address, never like the lot it may be.
  { sources: ['jc-municipal-lots', 'nj-parcels-hudson-parking'], meters: 90 },
  { sources: ['njt-parking-lots', 'nj-parcels-hudson-parking'], meters: 90 },
  // West New York's lots and Hoboken's garages were placed on their own tax parcels, so a site that's the same lot
  // is close: 30 m for West New York's 55th Street lot (specs/06). A different site was 91 m from Garage D.
  { sources: ['wny-parking-lots', 'nj-parcels-hudson-parking'], meters: 60 },
  { sources: ['hoboken-garages', 'nj-parcels-hudson-parking'], meters: 60 },
  // Bayonne's lots were placed on the parcels its ordinance names (ADR-0016).
  { sources: ['bayonne-parking-lots', 'nj-parcels-hudson-parking'], meters: 60 },
];

export interface Clusterable {
  sourceId: string;
  recordId: string;
  facilityKey: string;
  priority: number;
  matchTokens: readonly string[];
  region: string;
  lat: number;
  lng: number;
}

export interface Cluster<T extends Clusterable> {
  facilityId: string;
  primary: T;
  members: T[];
}

export function clusterRecords<T extends Clusterable>(
  records: readonly T[],
  maxDistance = MATCH_DISTANCE_M,
  nearby = NEARBY_MATCHES,
): Cluster<T>[] {
  const ordered = [...records].sort(
    (a, b) => a.priority - b.priority || compare(a.sourceId, b.sourceId) || compare(a.recordId, b.recordId),
  );
  const clusters: Cluster<T>[] = [];

  for (const record of ordered) {
    let best: { cluster: Cluster<T>; distance: number } | undefined;
    for (const cluster of clusters) {
      if (cluster.members.some((member) => member.sourceId === record.sourceId)) continue;
      for (const member of cluster.members) {
        if (member.region !== record.region) continue;
        const distance = metersBetween(member, record);
        const limit = namesMatch(member.matchTokens, record.matchTokens) ? maxDistance : nearbyLimit(nearby, member, record);
        if (distance <= limit && (!best || distance < best.distance)) {
          best = { cluster, distance };
        }
      }
    }
    if (best) {
      best.cluster.members.push(record);
    } else {
      clusters.push({ facilityId: record.facilityKey, primary: record, members: [record] });
    }
  }

  // Two different facilities can share a key; the later one (in the order above) gets a suffix.
  const seen = new Map<string, number>();
  for (const cluster of clusters) {
    const count = (seen.get(cluster.facilityId) ?? 0) + 1;
    seen.set(cluster.facilityId, count);
    if (count > 1) cluster.facilityId = `${cluster.facilityId}-${count}`;
  }
  return clusters;
}

/** How near two records with different names must be to match, or −1 when their sources aren't a nearby pair. */
function nearbyLimit(nearby: typeof NEARBY_MATCHES, a: Clusterable, b: Clusterable): number {
  const pair = nearby.find(({ sources }) => sources.includes(a.sourceId) && sources.includes(b.sourceId));
  return pair ? pair.meters : -1;
}

/** Great-circle distance; accurate to well under a meter at these distances. */
export function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const radians = Math.PI / 180;
  const dLat = (b.lat - a.lat) * radians;
  const dLng = (b.lng - a.lng) * radians;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * radians) * Math.cos(b.lat * radians) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_008.8 * Math.asin(Math.sqrt(h));
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
