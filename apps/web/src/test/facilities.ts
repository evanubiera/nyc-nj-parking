import type { RecommendedFacility, Source } from '@parking/api-client';

export const avenueM: RecommendedFacility = {
  id: 'nyc-dot-avenue-m',
  name: 'Avenue M Municipal Parking Field',
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
