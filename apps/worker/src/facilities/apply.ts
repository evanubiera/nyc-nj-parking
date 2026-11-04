// Writes one source's normalized records and rebuilds the facility tables from every source's records,
// all inside the run's transaction (ING-3). Facilities no source lists any more are withdrawn (ING-8), and
// a facility with a withheld record is never published (ING-11).
import { textArray, type TransactionSql } from '@parking/db';
import { IngestionError } from '../errors.ts';
import type { MeterPeriod } from '../normalize/meter-hours.ts';
import type { ApplyResult } from '../sources/types.ts';
import { clusterRecords } from './cluster.ts';
import type { Normalized, SourceRecordInput } from './types.ts';

const REBUILD_LOCK = 7_340_212;

export async function applyNormalized(tx: TransactionSql, sourceId: string, normalized: Normalized, now: Date): Promise<ApplyResult> {
  // ING-10: an empty result, or one where most rows couldn't be read, more likely means the source
  // changed shape than that every facility closed. Fail, and change nothing.
  if (normalized.invalidRows > normalized.records.length) {
    throw new IngestionError('normalize.invalid_record', `${normalized.invalidRows} rows could not be normalized`);
  }
  if (normalized.records.length === 0) {
    throw new IngestionError('normalize.empty', 'no records after normalizing');
  }

  const withdrawn = await replaceSourceRecords(tx, sourceId, normalized.records, now);
  await rebuildFacilities(tx, now);
  return { rowsRead: normalized.rowsRead, rowsWritten: normalized.records.length, rowsWithdrawn: withdrawn };
}

async function replaceSourceRecords(tx: TransactionSql, sourceId: string, records: SourceRecordInput[], now: Date): Promise<number> {
  for (const record of records) {
    await tx`
      insert into source_record (
        source_id, record_id, facility_key, priority, name, match_tokens, kind, operator_name, operator_type,
        address_line, locality, region, time_zone, location, spaces, official_url, meter_periods,
        lot_number, withheld_reason, confirmed, first_seen_at, last_seen_at)
      values (
        ${sourceId}, ${record.recordId}, ${record.facilityKey}, ${record.priority}, ${record.name},
        ${textArray(tx, record.matchTokens)}, ${record.kind}, ${record.operatorName}, ${record.operatorType},
        ${record.addressLine}, ${record.locality}, ${record.region}, ${record.timeZone},
        ST_SetSRID(ST_MakePoint(${record.lng}, ${record.lat}), 4326)::geography, ${record.spaces},
        ${record.officialUrl}, ${tx.json(record.meterPeriods as unknown as Parameters<typeof tx.json>[0])},
        ${record.lotNumber}, ${record.withheldReason}, ${record.confirmed}, ${now}, ${now})
      on conflict (source_id, record_id) do update set
        facility_key = excluded.facility_key, priority = excluded.priority, name = excluded.name,
        match_tokens = excluded.match_tokens, kind = excluded.kind, operator_name = excluded.operator_name,
        operator_type = excluded.operator_type, address_line = excluded.address_line, locality = excluded.locality,
        region = excluded.region, time_zone = excluded.time_zone, location = excluded.location,
        spaces = excluded.spaces, official_url = excluded.official_url, meter_periods = excluded.meter_periods,
        lot_number = excluded.lot_number, withheld_reason = excluded.withheld_reason, confirmed = excluded.confirmed,
        last_seen_at = excluded.last_seen_at`;
  }
  const removed = await tx`
    delete from source_record
    where source_id = ${sourceId} and not (record_id = any(${textArray(tx, records.map((record) => record.recordId))}))`;
  return removed.count;
}

interface StoredRecord {
  sourceId: string;
  recordId: string;
  facilityKey: string;
  priority: number;
  name: string;
  matchTokens: string[];
  kind: string;
  operatorName: string | null;
  operatorType: string;
  addressLine: string | null;
  locality: string;
  region: string;
  timeZone: string;
  lat: number;
  lng: number;
  spaces: number | null;
  officialUrl: string | null;
  meterPeriods: MeterPeriod[];
  lotNumber: string | null;
  withheldReason: string | null;
  confirmed: boolean;
}

export async function rebuildFacilities(tx: TransactionSql, now: Date): Promise<{ active: number; withdrawn: number }> {
  // Two sources finishing at the same time rebuild one after the other.
  await tx`select pg_advisory_xact_lock(${REBUILD_LOCK})`;

  const records = await tx<StoredRecord[]>`
    select source_id as "sourceId", record_id as "recordId", facility_key as "facilityKey", priority, name,
      match_tokens as "matchTokens", kind, operator_name as "operatorName", operator_type as "operatorType",
      address_line as "addressLine", locality, region, time_zone as "timeZone",
      ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng, spaces, official_url as "officialUrl",
      meter_periods as "meterPeriods", lot_number as "lotNumber", withheld_reason as "withheldReason", confirmed
    from source_record`;
  const clusters = clusterRecords(
    records.map((record) => ({ ...record, lat: Number(record.lat), lng: Number(record.lng) })),
  ).filter(({ members }) => members.every((member) => member.withheldReason === null));

  await tx`delete from facility_meter_period`;
  await tx`delete from facility_source`;

  for (const { facilityId, primary, members } of clusters) {
    // REC-9: confirmed when any of its records is, such as a candidate site that turned out to be a city lot.
    const confirmed = members.some((member) => member.confirmed);
    await tx`
      insert into facility (
        id, name, kind, operator_name, operator_type, address_line, locality, region, time_zone, location,
        spaces, official_url, lot_number, confirmed, status, first_seen_at, last_seen_at, withdrawn_at)
      values (
        ${facilityId}, ${primary.name}, ${primary.kind}, ${primary.operatorName}, ${primary.operatorType},
        ${primary.addressLine}, ${primary.locality}, ${primary.region}, ${primary.timeZone},
        ST_SetSRID(ST_MakePoint(${primary.lng}, ${primary.lat}), 4326)::geography, ${primary.spaces},
        ${primary.officialUrl}, ${primary.lotNumber}, ${confirmed}, 'active', ${now}, ${now}, null)
      on conflict (id) do update set
        name = excluded.name, kind = excluded.kind, operator_name = excluded.operator_name,
        operator_type = excluded.operator_type, address_line = excluded.address_line, locality = excluded.locality,
        region = excluded.region, time_zone = excluded.time_zone, location = excluded.location,
        spaces = excluded.spaces, official_url = excluded.official_url, lot_number = excluded.lot_number, confirmed = excluded.confirmed, status = 'active',
        last_seen_at = excluded.last_seen_at, withdrawn_at = null`;

    for (const member of members) {
      await tx`
        insert into facility_source (source_id, source_record_id, facility_id)
        values (${member.sourceId}, ${member.recordId}, ${facilityId})`;
    }

    for (const period of distinctPeriods(members.flatMap((member) => member.meterPeriods))) {
      await tx`
        insert into facility_meter_period (facility_id, days, starts_at, ends_at, max_stay_minutes, vehicle_class, source_text)
        values (${facilityId}, ${period.days}, ${period.startsAt}, ${period.endsAt}, ${period.maxStayMinutes},
                ${period.vehicleClass}, ${period.sourceText})`;
    }
  }

  const ids = clusters.map((cluster) => cluster.facilityId);
  const withdrawn = await tx`
    update facility set status = 'withdrawn', withdrawn_at = ${now}
    where status = 'active' and not (id = any(${textArray(tx, ids)}))`;
  return { active: clusters.length, withdrawn: withdrawn.count };
}

/** The same period from two meters (or two sources) is stored once. */
function distinctPeriods(periods: MeterPeriod[]): MeterPeriod[] {
  const seen = new Set<string>();
  return periods.filter((period) => {
    const key = [period.days, period.startsAt, period.endsAt, period.maxStayMinutes, period.vehicleClass].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
