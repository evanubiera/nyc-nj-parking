// WEB-1: every code the API can send has text in the catalog. Each Record below must list every value
// of its type from the contract, so adding a code there fails typecheck here until it has text.
import type { RecommendedFacility, Source } from '@parking/api-client';
import { describe, expect, it } from 'vitest';
import { en } from './en.ts';

const KINDS: Record<RecommendedFacility['kind'], true> = { garage: true, lot: true, field: true };
const OPERATOR_TYPES: Record<RecommendedFacility['operator']['type'], true> = {
  municipal: true,
  county: true,
  state: true,
  transit_agency: true,
  public_authority: true,
};
const MODIFICATIONS: Record<Source['modifications'][number], true> = {
  names_reformatted: true,
  addresses_reformatted: true,
  merged_across_sources: true,
  meter_hours_parsed: true,
  location_from_meters: true,
  inactive_meters_excluded: true,
  location_from_outline: true,
  private_or_unowned_excluded: true,
  lot_numbers_reformatted: true,
  duplicates_removed: true,
  municipalities_reformatted: true,
};

describe('message catalog', () => {
  it.each([
    ...Object.keys(KINDS).map((code) => `facility.kind.${code}`),
    ...Object.keys(OPERATOR_TYPES).map((code) => `facility.operatorType.${code}`),
    ...Object.keys(MODIFICATIONS).map((code) => `sources.change.${code}`),
  ])('WEB-1 has text for %s', (id) => {
    expect(en).toHaveProperty([id]);
  });

  it('ATT-1 keeps the disclaimer marked as a placeholder until PRD-2 is answered', () => {
    expect(en['disclaimer.text']).toMatch(/^\[Placeholder, PRD-2\]/);
  });
});
