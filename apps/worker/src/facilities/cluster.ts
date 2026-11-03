// S1-5: groups source records that describe the same facility. Two records are the same facility when
// they come from different sources, their names match (names.ts), and they're within MATCH_DISTANCE_M.
// Checked against the sources on 2026-11-03: correct matches were up to 497 m apart (the Gowanus field
// runs for blocks), so the limit is 750 m and the name has to match.
import { namesMatch } from '../normalize/names.ts';

export const MATCH_DISTANCE_M = 750;

export interface Clusterable {
  sourceId: string;
  recordId: string;
  facilityKey: string;
  priority: number;
  matchTokens: readonly string[];
  lat: number;
  lng: number;
}

export interface Cluster<T extends Clusterable> {
  facilityId: string;
  primary: T;
  members: T[];
}

export function clusterRecords<T extends Clusterable>(records: readonly T[], maxDistance = MATCH_DISTANCE_M): Cluster<T>[] {
  const ordered = [...records].sort(
    (a, b) => a.priority - b.priority || compare(a.sourceId, b.sourceId) || compare(a.recordId, b.recordId),
  );
  const clusters: Cluster<T>[] = [];

  for (const record of ordered) {
    let best: { cluster: Cluster<T>; distance: number } | undefined;
    for (const cluster of clusters) {
      if (cluster.members.some((member) => member.sourceId === record.sourceId)) continue;
      for (const member of cluster.members) {
        if (!namesMatch(member.matchTokens, record.matchTokens)) continue;
        const distance = metersBetween(member, record);
        if (distance <= maxDistance && (!best || distance < best.distance)) {
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
