// WEB-13 (ADR-0021): the counties, NYC boroughs, and their towns and neighbourhoods for the "Search by" dropdowns,
// from the place list in the app (ADR-0013). Picking from them sends nothing anywhere until a search runs.
import type { AreaId } from '@parking/api-client';
import type { Point } from '../utils/location.ts';
import { loadPlaces, type Place } from './geocoding.ts';

export interface AreaOption {
  id: AreaId;
  /** As the place list writes it: "Morris County", "Brooklyn". */
  name: string;
  state: 'NJ' | 'NY';
  /** The area's towns (NJ) or neighbourhoods (NYC), by name. */
  places: { name: string; point: Point }[];
}

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
// Every area in the contract (AreaId). Typecheck fails here when the contract adds one.
const ALL: Record<AreaId, true> = {
  'nj-atlantic': true, 'nj-bergen': true, 'nj-burlington': true, 'nj-camden': true, 'nj-cape-may': true, 'nj-cumberland': true,
  'nj-essex': true, 'nj-gloucester': true, 'nj-hudson': true, 'nj-hunterdon': true, 'nj-mercer': true, 'nj-middlesex': true,
  'nj-monmouth': true, 'nj-morris': true, 'nj-ocean': true, 'nj-passaic': true, 'nj-salem': true, 'nj-somerset': true,
  'nj-sussex': true, 'nj-union': true, 'nj-warren': true,
  'ny-bronx': true, 'ny-brooklyn': true, 'ny-manhattan': true, 'ny-queens': true, 'ny-staten-island': true,
};
export const AREA_IDS = Object.keys(ALL) as readonly AreaId[];
const known = new Set<string>(AREA_IDS);

/** "Morris County" is `nj-morris`; the borough "Staten Island" is `ny-staten-island`, as the API names them. */
export function areaId(state: 'NJ' | 'NY', name: string): AreaId | null {
  const id = `${state.toLowerCase()}-${slug(name.replace(/ County$/, ''))}`;
  return known.has(id) ? (id as AreaId) : null;
}

export function areasFrom(places: readonly Place[]): AreaOption[] {
  const byId = new Map<AreaId, AreaOption>();
  // NJ towns name their county; NYC neighbourhoods name their borough, and the boroughs themselves are "New York City".
  for (const place of places) {
    if (place.state === 'NY' && place.area === 'New York City') continue;
    const id = areaId(place.state, place.area);
    if (!id) continue;
    const area = byId.get(id) ?? { id, name: place.area, state: place.state, places: [] };
    area.places.push({ name: place.name, point: { lat: place.lat, lng: place.lng } });
    byId.set(id, area);
  }
  const areas = [...byId.values()];
  for (const area of areas) area.places.sort((a, b) => a.name.localeCompare(b.name));
  // New Jersey's counties first, then New York City's boroughs, each by name.
  return areas.sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
}

let areas: Promise<AreaOption[]> | undefined;
export function loadAreas(): Promise<AreaOption[]> {
  areas ??= loadPlaces().then(areasFrom);
  return areas;
}
