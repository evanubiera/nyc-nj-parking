// What the New York State sources share (ADR-0022, specs/06 "New York State"): the area they cover.

/**
 * New York State's box, the API's second coverage box (specs/05-api.md). A record outside it has bad coordinates.
 * New York City's own sources check the tighter `inNewYorkCity` (nyc.ts).
 */
export function inNewYorkState(point: { lat: number; lng: number }): boolean {
  return point.lat >= 40.49 && point.lat <= 45.02 && point.lng >= -79.77 && point.lng <= -71.85;
}

/** New York State's open data portal, and its terms (OPEN-NY Terms of Use, checked 2026-11-11, specs/06). */
export const NY_OPEN_DATA = 'data.ny.gov';
export const OPEN_NY_TERMS = 'https://data.ny.gov/dataset/OPEN-NY-Terms-Of-Use/77gx-ii52';
