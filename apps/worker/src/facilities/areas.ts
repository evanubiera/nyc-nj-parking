// REC-11 (ADR-0021): the county or borough a facility is in, from the outlines in ../data/areas.json, built by
// scripts/build-areas.ts. A point just outside every outline, such as a lot on a pier or a beach that the simplified
// coastline misses, takes the nearest area within NEAREST_M; further out, it has none. Only areas in the facility's own
// state count: NJ Transit's Suffern lots, in New York State 1 km from Bergen County, are in no area (S4-45).
import { readFileSync } from 'node:fs';

type Ring = [number, number][];
interface Area {
  id: string;
  name: string;
  state: 'NJ' | 'NY';
  rings: Ring[];
}

const AREAS: readonly Area[] = (JSON.parse(readFileSync(new URL('../data/areas.json', import.meta.url), 'utf8')) as { areas: Area[] }).areas;
export const NEAREST_M = 1_500;
const METERS_PER_DEGREE = 111_320;

/** Even–odd: inside when an odd number of the area's rings contain the point. */
function contains(area: Area, lat: number, lng: number): boolean {
  let inside = false;
  for (const ring of area.rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i]!;
      const [xj, yj] = ring[j]!;
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

/** Distance in meters from the point to the area's nearest edge (flat, fine at these distances). */
function distanceToEdge(area: Area, lat: number, lng: number): number {
  const scale = Math.cos((lat * Math.PI) / 180);
  let best = Infinity;
  for (const ring of area.rings) {
    for (let i = 1; i < ring.length; i += 1) {
      const [ax, ay] = [(ring[i - 1]![0] - lng) * scale, ring[i - 1]![1] - lat];
      const [bx, by] = [(ring[i]![0] - lng) * scale, ring[i]![1] - lat];
      const [dx, dy] = [bx - ax, by - ay];
      const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy)));
      best = Math.min(best, Math.hypot(ax + t * dx, ay + t * dy));
    }
  }
  return best * METERS_PER_DEGREE;
}

export function areaOf(point: { lat: number; lng: number; region: string }): string | null {
  const inState = AREAS.filter((area) => area.state === point.region);
  const inside = inState.find((area) => contains(area, point.lat, point.lng));
  if (inside) return inside.id;
  let nearest: { id: string; meters: number } | null = null;
  for (const area of inState) {
    const meters = distanceToEdge(area, point.lat, point.lng);
    if (meters <= NEAREST_M && (!nearest || meters < nearest.meters)) nearest = { id: area.id, meters };
  }
  return nearest?.id ?? null;
}

export const AREA_IDS: readonly string[] = AREAS.map((area) => area.id);
