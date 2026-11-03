// What the NYC sources share: the portal, terms, operator, boroughs, and the DOT facilities page.
import { titleCase } from '../normalize/names.ts';

export const NYC_OPEN_DATA = 'data.cityofnewyork.us';

/** NYC Admin Code § 23-502, which sets the terms for NYC Open Data (specs/06-sources.md). */
export const NYC_OPEN_DATA_TERMS = 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577';

export const NYC_DOT = 'NYC Department of Transportation';
export const NYC_DOT_PREFIX = 'nyc-dot';
export const NEW_YORK_TIME = 'America/New_York';

/** DOT's Municipal Parking Facilities page. We link to it; we don't copy it (SRC-1). */
const DOT_FACILITIES_PAGE = 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml';

/** The page's section for each borough, checked on 2026-11-03. */
const BOROUGH_SECTION: Record<string, string> = {
  bronx: 'bronx',
  brooklyn: 'kings',
  manhattan: 'manhattan',
  queens: 'queens',
  'staten island': 'richmond',
};

export function boroughName(value: string | null): string | null {
  if (!value) return null;
  const key = value.trim().toLowerCase();
  return key in BOROUGH_SECTION ? titleCase(key) : null;
}

export function dotFacilitiesUrl(borough: string): string {
  const section = BOROUGH_SECTION[borough.toLowerCase()];
  return section ? `${DOT_FACILITIES_PAGE}#${section}` : DOT_FACILITIES_PAGE;
}

/** A generous box around the five boroughs. A record outside it has bad coordinates. */
export function inNewYorkCity(lat: number, lng: number): boolean {
  return lat >= 40.47 && lat <= 40.93 && lng >= -74.28 && lng <= -73.68;
}
