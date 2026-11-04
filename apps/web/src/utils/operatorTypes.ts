import type { OperatorType } from '@parking/api-client';

// Every operator type in the contract (ADR-0007), in the order the filter shows them. Typecheck fails here
// when the contract adds one.
const ALL: Record<OperatorType, true> = {
  municipal: true,
  county: true,
  state: true,
  transit_agency: true,
  public_authority: true,
  unknown: true,
};

export const OPERATOR_TYPES = Object.keys(ALL) as readonly OperatorType[];
