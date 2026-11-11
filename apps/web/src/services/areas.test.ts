import { describe, expect, it } from 'vitest';
import places from '../data/places.json';
import { AREA_IDS, areaId, areasFrom } from './areas.ts';
import type { Place } from './geocoding.ts';

describe('areas for the Search by dropdowns (WEB-13)', () => {
  const areas = areasFrom((places as { places: Place[] }).places);

  it('REC-11 names areas as the API does', () => {
    expect(areaId('NJ', 'Cape May County')).toBe('nj-cape-may');
    expect(areaId('NY', 'Staten Island')).toBe('ny-staten-island');
    expect(areaId('NJ', 'Atlantis County')).toBeNull();
  });

  it('WEB-13 lists New Jersey\'s 21 counties, then New York City\'s 5 boroughs, each with its places', () => {
    expect(areas.map((area) => area.id)).toEqual(AREA_IDS); // listed NJ first, then NYC, each alphabetically
    expect(areas.slice(0, 2).map((area) => area.name)).toEqual(['Atlantic County', 'Bergen County']);
    expect(areas.at(-1)?.name).toBe('Staten Island');
    const morris = areas.find((area) => area.id === 'nj-morris')!;
    expect(morris.places.map((place) => place.name)).toContain('Morristown Town');
    expect(morris.places.map((place) => place.name)).not.toContain('Hoboken City');
    expect(areas.find((area) => area.id === 'ny-brooklyn')!.places.map((place) => place.name)).toContain('Park Slope');
    // The boroughs themselves aren't places in a borough.
    expect(areas.find((area) => area.id === 'ny-manhattan')!.places.map((place) => place.name)).not.toContain('Manhattan');
  });
});
