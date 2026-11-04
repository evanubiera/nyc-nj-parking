import type { MeterPeriod } from '../normalize/meter-hours.ts';

export type FacilityKind = 'garage' | 'lot' | 'field';
export type OperatorType = 'municipal' | 'county' | 'state' | 'transit_agency' | 'public_authority';

/** One facility as one source describes it, after normalizing (a `source_record` row). */
export interface SourceRecordInput {
  recordId: string;
  /** Our facility ID if this record ends up as its facility's primary, such as "nyc-dot-avenue-m". */
  facilityKey: string;
  /** Lower wins: the primary record supplies a facility's name, address, and location. */
  priority: number;
  name: string;
  matchTokens: string[];
  kind: FacilityKind;
  operatorName: string;
  operatorType: OperatorType;
  addressLine: string | null;
  locality: string;
  region: 'NY' | 'NJ';
  timeZone: string;
  lat: number;
  lng: number;
  spaces: number | null;
  officialUrl: string;
  meterPeriods: MeterPeriod[];
  /** REC-8: only when the source has several lots with this name, such as "2". */
  lotNumber: string | null;
  /** ING-11: the record is kept for matching, but its facility is never published. */
  withheldReason: WithheldReason | null;
}

export type WithheldReason = 'private_owner';

export interface Normalized {
  rowsRead: number;
  records: SourceRecordInput[];
  /** Rows that should have produced a record but couldn't, such as a meter with no coordinates. */
  invalidRows: number;
}
