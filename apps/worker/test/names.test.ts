import { describe, expect, it } from 'vitest';
import { matchTokens, namesMatch, titleCase } from '../src/normalize/names.ts';
import { facdbAddress, facdbDisplayName, facdbKind } from '../src/sources/nyc-facdb-dot.ts';
import { meterFieldName } from '../src/sources/nyc-meters-offstreet.ts';

describe('names', () => {
  it.each([
    ['AVENUE M, FIELD', 'Avenue M Municipal Parking Field'],
    ['BENSONHURST NO. 1, FIELD', 'Bensonhurst No. 1 Municipal Parking Field'],
    ['JEROME - GUN HILL ROAD, GARAGE/FIELD', 'Jerome - Gun Hill Road Municipal Parking Garage'],
    ['BROADWAY - 31ST STREET, FIELD', 'Broadway - 31st Street Municipal Parking Field'],
    ['STATEN ISLAND COURTHOUSE GARAGE', 'Staten Island Courthouse Garage'],
    ['FERRY TERMINAL, SOUTH FIELD (#1)', 'Ferry Terminal South Field (#1)'],
    ['WHITE PLAINS ROAD & MARAN PLACE, FIELD', 'White Plains Road & Maran Place Municipal Parking Field'],
  ])('ATT-3 reformats the Facilities Database name %s', (facname, expected) => {
    expect(facdbDisplayName(facname)).toBe(expected);
  });

  it('REC-4 tells garages from fields', () => {
    expect(facdbKind('DELANCEY - ESSEX, GARAGE')).toBe('garage');
    expect(facdbKind('QUEENSBORO HALL, GARAGE/FIELD')).toBe('garage');
    expect(facdbKind('CANARSIE, FIELD')).toBe('field');
  });

  it.each([
    ['2602 EAST 17TH STREET, BROOKLYN, NY 11235', '2602 East 17th Street'],
    ['214-32 41 AVENUE', '214-32 41 Avenue'],
    ['STEINWAY ST, QUEENS, NY 11103', 'Steinway St'],
    [null, null],
  ])('ATT-3 reformats the address %s', (address, expected) => {
    expect(facdbAddress(address)).toBe(expected);
  });

  it('ATT-3 names a meters-only field as DOT does', () => {
    expect(meterFieldName('Meeker Avenue Parking Field')).toBe('Meeker Avenue Municipal Parking Field');
    expect(meterFieldName('Rosedale')).toBe('Rosedale Municipal Parking Field');
  });

  it('REC-4 gives the same match tokens to both sources\' names for a field', () => {
    expect(matchTokens('BENSONHURST NO. 1, FIELD')).toEqual(matchTokens('Bensonhurst #1'));
    expect(matchTokens('BROADWAY - 31ST STREET, FIELD')).toEqual(matchTokens('Broadway-31st Street'));
    expect(matchTokens('Gowanus Parking Field')).toEqual(matchTokens('GOWANUS, FIELD'));
  });

  it('REC-4 matches names that differ only in spacing or extra words, but not in number', () => {
    expect(namesMatch(matchTokens('SUNNY SIDE, FIELD'), matchTokens('Sunnyside'))).toBe(true);
    expect(namesMatch(matchTokens('WHITE PLAINS ROAD & MARAN PLACE, FIELD'), matchTokens('White Plains Road'))).toBe(true);
    expect(namesMatch(matchTokens('FERRY TERMINAL, SOUTH FIELD (#1)'), matchTokens('Ferry Terminal #1'))).toBe(true);
    expect(namesMatch(matchTokens('DITMARS NO. 1, FIELD'), matchTokens('Ditmars #2'))).toBe(false);
    expect(namesMatch([], matchTokens('Avenue M'))).toBe(false);
  });

  it('keeps ordinals and small words lower case', () => {
    expect(titleCase('EAST 190TH STREET AND MARAN PLACE')).toBe('East 190th Street and Maran Place');
  });
});
