import { describe, expect, it } from 'vitest';
import { properCaseAddress } from './addressCase.ts';

describe('properCaseAddress', () => {
  it('WEB-11 puts an address written in capitals in proper case', () => {
    expect(properCaseAddress('120 BROADWAY, New York, NY')).toBe('120 Broadway, New York, NY');
    expect(properCaseAddress('47-10 AUSTELL PLACE, Long Island City, NY')).toBe('47-10 Austell Place, Long Island City, NY');
    expect(properCaseAddress('22 2ND ST, HOBOKEN, NJ, 07030')).toBe('22 2nd St, Hoboken, NJ, 07030');
  });

  it('WEB-11 gives a numbered street its ordinal, as people write it', () => {
    expect(properCaseAddress('350 5 AVENUE, Brooklyn, NY')).toBe('350 5th Avenue, Brooklyn, NY');
    expect(properCaseAddress('1 EAST 42 STREET, New York, NY')).toBe('1 East 42nd Street, New York, NY');
    expect(properCaseAddress('11 WEST 111 STREET, New York, NY')).toBe('11 West 111th Street, New York, NY');
    expect(properCaseAddress('120A BEACH 116 STREET, Rockaway Park, NY')).toBe('120A Beach 116th Street, Rockaway Park, NY');
  });

  it('WEB-11 keeps initials, single letters, and short joining words as people write them', () => {
    expect(properCaseAddress('500 FDR DRIVE, New York, NY')).toBe('500 FDR Drive, New York, NY');
    expect(properCaseAddress('1 MLK JR BOULEVARD, Newark, NJ')).toBe('1 MLK Jr Boulevard, Newark, NJ');
    expect(properCaseAddress('1 AVENUE A, New York, NY')).toBe('1 Avenue A, New York, NY');
    expect(properCaseAddress('1 AVENUE OF THE AMERICAS, New York, NY')).toBe('1 Avenue of the Americas, New York, NY');
    expect(properCaseAddress('10 ST MARKS PLACE, New York, NY')).toBe('10 St Marks Place, New York, NY');
    expect(properCaseAddress("12 O'BRIEN AVENUE, Staten Island, NY")).toBe("12 O'Brien Avenue, Staten Island, NY");
    expect(properCaseAddress("120 B'WAY, New York, NY")).toBe("120 B'way, New York, NY");
    expect(properCaseAddress('100 MCDONALD AVENUE, Brooklyn, NY')).toBe('100 McDonald Avenue, Brooklyn, NY');
  });

  it('WEB-11 leaves an address already in mixed case, and state codes, as they are', () => {
    expect(properCaseAddress('28 2nd Street, Hoboken, NJ, 07030')).toBe('28 2nd Street, Hoboken, NJ, 07030');
    expect(properCaseAddress('1 MAIN STREET, Brooklyn, NY')).toBe('1 Main Street, Brooklyn, NY');
  });
});
