import type { RecommendedFacility, Source } from '@parking/api-client';

export const avenueM: RecommendedFacility = {
  id: 'nyc-dot-avenue-m',
  name: 'Avenue M Municipal Parking Field',
  lotNumber: null,
  confirmed: true,
  kind: 'field',
  operator: { name: 'NYC Department of Transportation', type: 'municipal' },
  address: { line: '1624 Chestnut Avenue', locality: 'Brooklyn', region: 'NY' },
  location: { lat: 40.61877, lng: -73.95869 },
  distanceMeters: 340,
  openingHours: null,
  meteredHours: {
    timeZone: 'America/New_York',
    periods: [
      { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], from: '07:00', to: '22:00', maxStayMinutes: 240, vehicleClass: 'passenger' },
      { days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], from: '07:00', to: '22:00', maxStayMinutes: 900, vehicleClass: 'passenger' },
    ],
    sourceText: ['15HR Pas Mon-Sat 0700-2200', '4HR Pas Mon-Sat 0700-2200'],
  },
  rates: [],
  officialUrl: 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#kings',
  sources: [
    { id: 'nyc-facdb-dot', dataUpdatedAt: '2026-07-16T13:33:28.000Z' },
    { id: 'nyc-meters-offstreet', dataUpdatedAt: '2026-11-02T13:16:13.000Z' },
  ],
};

export const delancey: RecommendedFacility = {
  id: 'nyc-dot-delancey-essex',
  name: 'Delancey - Essex Municipal Parking Garage',
  lotNumber: null,
  confirmed: true,
  kind: 'garage',
  operator: { name: 'NYC Department of Transportation', type: 'municipal' },
  address: { line: '105 Essex Street', locality: 'Manhattan', region: 'NY' },
  location: { lat: 40.71936, lng: -73.98829 },
  distanceMeters: 1250,
  openingHours: null,
  meteredHours: null,
  rates: [],
  officialUrl: 'https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml#manhattan',
  sources: [{ id: 'nyc-facdb-dot', dataUpdatedAt: '2026-07-16T13:33:28.000Z' }],
};

/** One of an NJ Transit station's lots (REC-8), from the saved fixture of 2026-11-03. */
export const morristown2: RecommendedFacility = {
  id: 'njt-morristown-02',
  name: 'Morristown',
  lotNumber: '2',
  confirmed: true,
  kind: 'lot',
  operator: { name: 'Morristown Town', type: 'municipal' },
  address: { line: null, locality: 'Morristown Town', region: 'NJ' },
  location: { lat: 40.79761, lng: -74.47384 },
  distanceMeters: 180,
  openingHours: null,
  meteredHours: null,
  rates: [],
  officialUrl: 'https://www.morristown-nj.org/',
  sources: [{ id: 'njt-parking-lots', dataUpdatedAt: '2026-10-08T17:27:08.341Z' }],
};

/** An unconfirmed site from tax records (REC-9, ADR-0012), from the saved fixture of 2026-11-04. */
export const montgomerySite: RecommendedFacility = {
  id: 'jc-site-14102-12',
  name: '179 Montgomery St.',
  lotNumber: null,
  confirmed: false,
  kind: 'lot',
  operator: { name: null, type: 'unknown' },
  address: { line: null, locality: 'Jersey City', region: 'NJ' },
  location: { lat: 40.71703, lng: -74.04278 },
  distanceMeters: 60,
  openingHours: null,
  meteredHours: null,
  rates: [],
  officialUrl: null,
  sources: [{ id: 'nj-parcels-jc-parking', dataUpdatedAt: '2026-08-18T09:32:38.134Z' }],
};

export const sources: Source[] = [
  {
    id: 'nyc-facdb-dot',
    publisher: 'Department of City Planning (DCP)',
    title: 'Facilities Database',
    datasetUrl: 'https://data.cityofnewyork.us/d/ji82-xba5',
    termsUrl: 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577',
    creditText: null,
    modifications: ['names_reformatted', 'addresses_reformatted', 'merged_across_sources'],
    dataUpdatedAt: '2026-07-16T13:33:28.000Z',
  },
  {
    id: 'nyc-meters-offstreet',
    publisher: 'Department of Transportation (DOT)',
    title: 'Parking Meters Locations and Status',
    datasetUrl: 'https://data.cityofnewyork.us/d/693u-uax6',
    termsUrl: 'https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577',
    creditText: null,
    modifications: ['meter_hours_parsed', 'inactive_meters_excluded'],
    dataUpdatedAt: '2026-11-02T13:16:13.000Z',
  },
];
