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

  it('WEB-13 lists New Jersey\'s 21 counties, then New York\'s 57 counties and 5 boroughs, each with its places', () => {
    // New Jersey's counties first, then New York's counties and boroughs, each by name.
    expect([...areas.map((area) => area.id)].sort()).toEqual([...AREA_IDS].sort());
    expect(areas.slice(0, 2).map((area) => area.name)).toEqual(['Atlantic County', 'Bergen County']);
    expect(areas.findIndex((area) => area.state === 'NY')).toBe(21);
    expect(areas.find((area) => area.id === 'ny-erie')!.places.map((place) => place.name)).toContain('Buffalo City');
    const morris = areas.find((area) => area.id === 'nj-morris')!;
    expect(morris.places.map((place) => place.name)).toContain('Morristown Town');
    expect(morris.places.map((place) => place.name)).not.toContain('Hoboken City');
    expect(areas.find((area) => area.id === 'ny-brooklyn')!.places.map((place) => place.name)).toContain('Park Slope');
    // The boroughs themselves aren't places in a borough.
    expect(areas.find((area) => area.id === 'ny-manhattan')!.places.map((place) => place.name)).not.toContain('Manhattan');
  });
});
