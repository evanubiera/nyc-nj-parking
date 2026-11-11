import { describe, expect, it } from 'vitest';
import { njTownName } from '../src/normalize/towns.ts';
import { otherStateTown } from '../src/sources/njt-parking-lots.ts';

describe('NJ town names (S4-44)', () => {
  it('WEB-13 reads an official label as the name the rest of the app uses', () => {
    expect(njTownName('Oradell Borough', 'Bergen')).toBe('Oradell');
    expect(njTownName('Montclair Township', 'Essex')).toBe('Montclair');
    expect(njTownName('Jersey City', 'Hudson')).toBe('Jersey City');
    expect(njTownName('Atlantic City', 'Atlantic')).toBe('Atlantic City');
  });

  it('WEB-13 reads NJDOT\'s abbreviations, labels turned round, a kind too many, and a bare name', () => {
    expect(njTownName('Clinton Twp', 'Hunterdon')).toBe('Clinton Township');
    expect(njTownName('Mount Arlington Boro', 'Morris')).toBe('Mount Arlington');
    expect(njTownName('City of Englewood', 'Bergen')).toBe('Englewood');
    expect(njTownName('South Orange Village Township', 'Essex')).toBe('South Orange');
    expect(njTownName('North Bergen Townsip', 'Hudson')).toBe('North Bergen');
    expect(njTownName('Clifton', 'Passaic')).toBe('Clifton');
  });

  it('WEB-13 tells towns with one label apart by their county, and keeps a town apart from its township', () => {
    expect(njTownName('Clinton Town', 'Hunterdon')).toBe('Clinton Town');
    expect(njTownName('Clinton Township', 'Hunterdon')).toBe('Clinton Township');
    expect(njTownName('Washington Township', 'Morris')).toBe('Washington Township');
    expect(njTownName('Washington Township')).toBeNull(); // four counties have one
  });

  it('WEB-13 leaves a place outside New Jersey, or a name no town has, unread', () => {
    expect(njTownName('Philadelphia, PA', 'Philadelphia, PA')).toBeNull();
    expect(njTownName('Monmouth', null)).toBeNull();
  });
});

describe('Towns outside New Jersey in NJ Transit\'s lots (S5-3)', () => {
  it('WEB-13 names them plainly, as New York\'s parcel sites do', () => {
    expect(otherStateTown('Ramapo Town, NY')).toBe('Ramapo');
    expect(otherStateTown('Greenwood Lake Village')).toBe('Greenwood Lake');
    expect(otherStateTown('Philadelphia, PA')).toBe('Philadelphia');
    expect(otherStateTown('Warwick')).toBe('Warwick');
  });
});
