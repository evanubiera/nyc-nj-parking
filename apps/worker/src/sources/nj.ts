// What the NJ sources share: the area they cover and the operators' own pages (specs/06, "New Jersey adapters").

/** NJ Transit's Parking page, for lots whose record gives no site of their own. Checked on 2026-11-03. */
export const NJT_PARKING_PAGE = 'https://www.njtransit.com/parking';

/** NJDOT's Park and Ride Locator. The layer's own `URL` field is empty. Checked on 2026-11-03. */
export const NJDOT_PARK_RIDE_PAGE = 'https://dot.nj.gov/transportation/commuter/rideshare/prlocate.shtm';

/**
 * The API's coverage box (specs/05-api.md). NJ Transit's lots in Rockland and Orange counties, NY, are
 * inside it. A record outside it has bad coordinates.
 */
export function inCoverageArea(point: { lat: number; lng: number }): boolean {
  return point.lat >= 38.9 && point.lat <= 41.4 && point.lng >= -75.6 && point.lng <= -73.6;
}
