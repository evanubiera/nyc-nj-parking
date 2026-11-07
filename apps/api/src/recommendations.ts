// S1-7 and S2-7: public facilities near a point, nearest first, optionally of some operator types (REC-1 to REC-8). The request point is rounded
// to 3 decimal places before use and is never logged, stored, or returned (PRIV-3, ADR-0006).
import type { MeterPeriod, OpeningHours, OperatorType, Rate, RecommendationList, RecommendedFacility } from '@parking/api-client';
import { maskToDays, textArray, timeOfDay, type Sql } from '@parking/db';

export const MAX_RESULTS = 50;

/** NYC and NJ (specs/05-api.md). Outside it: 422 location.out_of_area (REC-3). */
export const COVERAGE = { minLat: 38.9, maxLat: 41.4, minLng: -75.6, maxLng: -73.6 } as const;

export interface RecommendationQuery {
  lat: number;
  lng: number;
  radius: number;
  /** REC-7: only these types. Absent means every type. */
  operatorType?: OperatorType[];
}

/** PRIV-3: about 110 m north–south and 85 m east–west at NYC's latitude. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function inCoverage(lat: number, lng: number): boolean {
  return lat >= COVERAGE.minLat && lat <= COVERAGE.maxLat && lng >= COVERAGE.minLng && lng <= COVERAGE.maxLng;
}

interface FacilityRow {
  id: string;
  name: string;
  lotNumber: string | null;
  confirmed: boolean;
  kind: RecommendedFacility['kind'];
  operatorName: string | null;
  operatorType: RecommendedFacility['operator']['type'];
  addressLine: string | null;
  locality: string;
  region: RecommendedFacility['address']['region'];
  timeZone: string;
  lat: number;
  lng: number;
  officialUrl: string | null;
  spaces: number | null;
  distance: number;
}

export async function findRecommendations(sql: Sql, query: RecommendationQuery): Promise<RecommendationList> {
  const lat = roundCoordinate(query.lat);
  const lng = roundCoordinate(query.lng);

  const facilities = await sql<FacilityRow[]>`
    with origin as (select ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography as point)
    select f.id, f.name, f.lot_number as "lotNumber", f.confirmed, f.kind, f.operator_name as "operatorName", f.operator_type as "operatorType",
      f.address_line as "addressLine", f.locality, f.region, f.time_zone as "timeZone",
      ST_Y(f.location::geometry) as lat, ST_X(f.location::geometry) as lng, f.official_url as "officialUrl", f.spaces,
      ST_Distance(f.location, origin.point) as distance
    from facility f, origin
    where f.status = 'active' and ST_DWithin(f.location, origin.point, ${query.radius})
      ${query.operatorType ? sql`and f.operator_type = any(${textArray(sql, query.operatorType)})` : sql``}
    order by distance, f.id
    limit ${MAX_RESULTS}`;
  if (facilities.length === 0) return { results: [] };

  const ids = textArray(sql, facilities.map((facility) => facility.id));
  const [meterRows, hourRows, rateRows, sourceRows] = await Promise.all([
    sql<{ facilityId: string; days: number; startsAt: string; endsAt: string; maxStayMinutes: number | null; vehicleClass: MeterPeriod['vehicleClass']; sourceText: string }[]>`
      select facility_id as "facilityId", days, starts_at::text as "startsAt", ends_at::text as "endsAt",
        max_stay_minutes as "maxStayMinutes", vehicle_class as "vehicleClass", source_text as "sourceText"
      from facility_meter_period where facility_id = any(${ids})
      order by facility_id, days desc, starts_at, max_stay_minutes nulls last, vehicle_class nulls last`,
    sql<{ facilityId: string; days: number; opensAt: string; closesAt: string }[]>`
      select facility_id as "facilityId", days, opens_at::text as "opensAt", closes_at::text as "closesAt"
      from facility_hours where facility_id = any(${ids}) order by facility_id, days desc, opens_at`,
    sql<{ facilityId: string; days: number; startsAt: string; endsAt: string; kind: Rate['kind']; upToMinutes: number | null; amountMinor: number; currency: string }[]>`
      select facility_id as "facilityId", days, starts_at::text as "startsAt", ends_at::text as "endsAt", kind,
        up_to_minutes as "upToMinutes", amount_minor as "amountMinor", currency
      from facility_rate where facility_id = any(${ids}) order by facility_id, days desc, starts_at, kind`,
    sql<{ facilityId: string; sourceId: string; dataUpdatedAt: Date | null }[]>`
      select distinct fs.facility_id as "facilityId", fs.source_id as "sourceId", s.data_updated_at as "dataUpdatedAt"
      from facility_source fs join source s on s.id = fs.source_id
      where fs.facility_id = any(${ids}) order by fs.facility_id, fs.source_id`,
  ]);

  const byFacility = <T extends { facilityId: string }>(rows: T[]) => {
    const grouped = new Map<string, T[]>();
    for (const row of rows) grouped.set(row.facilityId, [...(grouped.get(row.facilityId) ?? []), row]);
    return (id: string) => grouped.get(id) ?? [];
  };
  const metersOf = byFacility(meterRows);
  const hoursOf = byFacility(hourRows);
  const ratesOf = byFacility(rateRows);
  const sourcesOf = byFacility(sourceRows);

  return {
    results: facilities.map((facility) => {
      const meters = metersOf(facility.id);
      const hours = hoursOf(facility.id);
      return {
        id: facility.id,
        name: facility.name,
        lotNumber: facility.lotNumber,
        confirmed: facility.confirmed,
        kind: facility.kind,
        operator: { name: facility.operatorName, type: facility.operatorType },
        address: { line: facility.addressLine, locality: facility.locality, region: facility.region },
        location: { lat: round(Number(facility.lat), 5), lng: round(Number(facility.lng), 5) },
        distanceMeters: Math.round(Number(facility.distance) / 10) * 10,
        spaces: facility.spaces,
        openingHours: hours.length === 0 ? null : openingHours(facility.timeZone, hours),
        meteredHours:
          meters.length === 0
            ? null
            : {
                timeZone: facility.timeZone,
                periods: meters.map((row) => ({
                  days: maskToDays(row.days),
                  from: timeOfDay(row.startsAt),
                  to: timeOfDay(row.endsAt),
                  maxStayMinutes: row.maxStayMinutes,
                  vehicleClass: row.vehicleClass,
                })),
                sourceText: [...new Set(meters.map((row) => row.sourceText))].sort(),
              },
        rates: ratesOf(facility.id).map((row) => ({
          days: maskToDays(row.days),
          from: timeOfDay(row.startsAt),
          to: timeOfDay(row.endsAt),
          kind: row.kind,
          upToMinutes: row.upToMinutes,
          price: { amountMinor: row.amountMinor, currency: row.currency },
        })),
        officialUrl: facility.officialUrl,
        sources: sourcesOf(facility.id).map((row) => ({
          id: row.sourceId,
          dataUpdatedAt: row.dataUpdatedAt ? row.dataUpdatedAt.toISOString() : null,
        })),
      } satisfies RecommendedFacility;
    }),
  };
}

function openingHours(timeZone: string, rows: { days: number; opensAt: string; closesAt: string }[]): OpeningHours {
  return {
    timeZone,
    periods: rows.map((row) => ({ days: maskToDays(row.days), opens: timeOfDay(row.opensAt), closes: timeOfDay(row.closesAt) })),
  };
}

function round(value: number, places: number): number {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
