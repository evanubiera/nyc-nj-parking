// Test data written straight to the tables. The API tests can't use the worker (FND-6), so this is
// the smallest set of rows the read side needs: a source, its record, the facility, and the link.
import { textArray, type Sql } from '@parking/db';

export async function seedSource(sql: Sql, id: string, dataUpdatedAt: Date | null = new Date('2026-07-16T13:33:28Z')) {
  await sql`
    insert into source (id, publisher, title, dataset_url, terms_url, credit_text, modification_codes, data_updated_at)
    values (${id}, 'Test Publisher', ${`Dataset ${id}`}, ${`https://data.example.test/d/${id}`},
            'https://data.example.test/terms', null, ${textArray(sql, ['names_reformatted'])}, ${dataUpdatedAt})
    on conflict (id) do nothing`;
}

export interface SeedFacility {
  id: string;
  lat: number;
  lng: number;
  name?: string;
  kind?: 'garage' | 'lot' | 'field';
  status?: 'active' | 'withdrawn';
  addressLine?: string | null;
  operatorType?: 'municipal' | 'county' | 'state' | 'transit_agency' | 'public_authority';
  lotNumber?: string | null;
  sourceIds?: string[];
  meterPeriods?: { days: number; startsAt: string; endsAt: string; maxStayMinutes: number | null; vehicleClass: string | null; sourceText: string }[];
}

export async function seedFacility(sql: Sql, facility: SeedFacility): Promise<void> {
  const now = new Date('2026-11-03T12:00:00Z');
  const status = facility.status ?? 'active';
  await sql`
    insert into facility (id, name, kind, operator_name, operator_type, address_line, locality, region, time_zone,
      location, official_url, lot_number, status, first_seen_at, last_seen_at, withdrawn_at)
    values (${facility.id}, ${facility.name ?? `Facility ${facility.id}`}, ${facility.kind ?? 'field'},
      'NYC Department of Transportation', ${facility.operatorType ?? 'municipal'}, ${facility.addressLine === undefined ? '1 Test Street' : facility.addressLine},
      'Brooklyn', 'NY', 'America/New_York', ST_SetSRID(ST_MakePoint(${facility.lng}, ${facility.lat}), 4326)::geography,
      'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#kings', ${facility.lotNumber ?? null}, ${status}, ${now}, ${now},
      ${status === 'withdrawn' ? now : null})`;
  for (const sourceId of facility.sourceIds ?? ['test-source']) {
    await seedSource(sql, sourceId);
    await sql`
      insert into source_record (source_id, record_id, facility_key, priority, name, match_tokens, kind, operator_name,
        operator_type, locality, region, time_zone, location, official_url, first_seen_at, last_seen_at)
      values (${sourceId}, ${facility.id}, ${facility.id}, 1, 'x', '{x}', 'field', 'NYC Department of Transportation',
        'municipal', 'Brooklyn', 'NY', 'America/New_York', ST_SetSRID(ST_MakePoint(${facility.lng}, ${facility.lat}), 4326)::geography,
        'https://example.test', ${now}, ${now})`;
    await sql`insert into facility_source (source_id, source_record_id, facility_id) values (${sourceId}, ${facility.id}, ${facility.id})`;
  }
  for (const period of facility.meterPeriods ?? []) {
    await sql`
      insert into facility_meter_period (facility_id, days, starts_at, ends_at, max_stay_minutes, vehicle_class, source_text)
      values (${facility.id}, ${period.days}, ${period.startsAt}, ${period.endsAt}, ${period.maxStayMinutes},
              ${period.vehicleClass}, ${period.sourceText})`;
  }
}

/** A grid of `count` facilities starting at (lat, lng), 0.002° apart (about 220 m by 170 m). */
export async function seedGrid(sql: Sql, count: number, lat: number, lng: number): Promise<void> {
  await seedSource(sql, 'grid-source');
  const now = new Date('2026-11-03T12:00:00Z');
  await sql`
    insert into source_record (source_id, record_id, facility_key, priority, name, match_tokens, kind, operator_name,
      operator_type, locality, region, time_zone, location, official_url, first_seen_at, last_seen_at)
    select 'grid-source', 'grid-' || i, 'grid-' || i, 1, 'x', '{x}', 'field', 'NYC Department of Transportation',
      'municipal', 'Brooklyn', 'NY', 'America/New_York',
      ST_SetSRID(ST_MakePoint(${lng} + (i / 100) * 0.002, ${lat} + (i % 100) * 0.002), 4326)::geography,
      'https://example.test', ${now}, ${now}
    from generate_series(0, ${count - 1}) as i`;
  await sql`
    insert into facility (id, name, kind, operator_name, operator_type, address_line, locality, region, time_zone,
      location, official_url, status, first_seen_at, last_seen_at)
    select record_id, 'Grid ' || record_id, 'field', operator_name, operator_type, null, locality, region, time_zone,
      location, 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#kings', 'active', ${now}, ${now}
    from source_record where source_id = 'grid-source'`;
  await sql`
    insert into facility_source (source_id, source_record_id, facility_id)
    select source_id, record_id, record_id from source_record where source_id = 'grid-source'`;
  await sql`analyze facility`;
}
