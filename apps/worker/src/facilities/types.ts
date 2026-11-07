import type { MeterPeriod } from '../normalize/meter-hours.ts';

export type FacilityKind = 'garage' | 'lot' | 'field';
export type OperatorType = 'municipal' | 'county' | 'state' | 'transit_agency' | 'public_authority' | 'unknown';

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
  /** Null only for an unconfirmed site, whose owner isn't recorded (ADR-0012). */
  operatorName: string | null;
  operatorType: OperatorType;
  addressLine: string | null;
  locality: string;
  region: 'NY' | 'NJ';
  timeZone: string;
  lat: number;
  lng: number;
  spaces: number | null;
  /** Null only for an unconfirmed site (ADR-0012). */
  officialUrl: string | null;
  meterPeriods: MeterPeriod[];
  /** Rates as the source states them (S4-12). Empty when it gives none. */
  rates: RateInput[];
  /** When it's open, as the source states it (S4-22). Absent or empty when it gives none; never meter hours (WEB-6). */
  openingHours?: OpeningPeriod[];
  /** REC-9: false for a candidate site from tax records, which may not be open to the public (ADR-0012). */
  confirmed: boolean;
  /** REC-8: only when the source has several lots with this name, such as "2". */
  lotNumber: string | null;
  /** ING-11: the record is kept for matching, but its facility is never published. */
  withheldReason: WithheldReason | null;
}

export type WithheldReason = 'private_owner';

/** One opening period, as stored in `source_record.opening_hours` and then `facility_hours` (specs/03). */
export interface OpeningPeriod {
  /** Bit mask, Monday = 1 through Sunday = 64. */
  days: number;
  /** Local wall-clock times, "HH:MM"; "24:00" closes at midnight. */
  opensAt: string;
  closesAt: string;
}

/** One rate, as stored in `source_record.rates` and then `facility_rate` (specs/03). */
export interface RateInput {
  /** Bit mask, Monday = 1 through Sunday = 64. */
  days: number;
  /** Local wall-clock times, "HH:MM". */
  startsAt: string;
  endsAt: string;
  kind: 'per_hour' | 'up_to_duration' | 'daily_max' | 'monthly_permit' | 'overnight_pass';
  upToMinutes: number | null;
  /** Minor units (cents), never a float (CLAUDE.md rule 11). */
  amountMinor: number;
  currency: 'USD';
}

export interface Normalized {
  rowsRead: number;
  records: SourceRecordInput[];
  /** Rows that should have produced a record but couldn't, such as a meter with no coordinates. */
  invalidRows: number;
}
