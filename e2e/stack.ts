// The smoke test's own stack (S1-10, S2-9), in one process. A fresh database (TEST_DATABASE_URL, or PGlite +
// PostGIS in-process), the NYC and NJ sources ingested through the real worker code from the saved fixtures
// (no upstream calls), the real API, and a one-layer map style, so no tile host is called. The NJ sources
// aren't admitted yet (S2-10); loading their fixtures into this throwaway database is testing, not ingesting.
import { createServer } from 'node:http';
import { connectTest, startTestDatabase } from '@parking/db/testing';
import { buildApp } from '../apps/api/src/app.ts';
import { runSource } from '../apps/worker/src/run.ts';
import { bayonneParkingLots } from '../apps/worker/src/sources/bayonne-parking-lots.ts';
import { bloomfieldParkingLots } from '../apps/worker/src/sources/bloomfield-parking-lots.ts';
import { harrisonParkingCenter } from '../apps/worker/src/sources/harrison-parking-center.ts';
import { hobokenGarages } from '../apps/worker/src/sources/hoboken-garages.ts';
import { jcMunicipalLots } from '../apps/worker/src/sources/jc-municipal-lots.ts';
import { njParcelsBergenParking, njParcelsEssexParking, njParcelsHudsonParking } from '../apps/worker/src/sources/nj-parcels-parking.ts';
import { njdotParkRide } from '../apps/worker/src/sources/njdot-park-ride.ts';
import { njtParkingLots } from '../apps/worker/src/sources/njt-parking-lots.ts';
import { nycFacdbDot } from '../apps/worker/src/sources/nyc-facdb-dot.ts';
import { nutleyParkingLots } from '../apps/worker/src/sources/nutley-parking-lots.ts';
import { nycMetersOffstreet } from '../apps/worker/src/sources/nyc-meters-offstreet.ts';
import { southOrangeParkingLots } from '../apps/worker/src/sources/south-orange-parking-lots.ts';
import { unionCityParkingLots } from '../apps/worker/src/sources/union-city-parking-lots.ts';
import { veronaParkingLots } from '../apps/worker/src/sources/verona-parking-lots.ts';
import { westwoodParkingLots } from '../apps/worker/src/sources/westwood-parking-lots.ts';
import { oradellParkingLots } from '../apps/worker/src/sources/oradell-parking-lots.ts';
import { wnyParkingLots } from '../apps/worker/src/sources/wny-parking-lots.ts';
import { fixtureHttp } from '../apps/worker/test/fixtures.ts';
import { testLogger } from '../apps/worker/test/support.ts';

export const API_PORT = Number(process.env.E2E_API_PORT ?? 8181);
export const STYLE_PORT = Number(process.env.E2E_STYLE_PORT ?? 8182);

/** A map style with no sources: a plain background, enough to render, tap, and place markers. */
const STYLE = {
  version: 8,
  name: 'smoke-test',
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8ecef' } }],
};

const database = await startTestDatabase();
const sql = connectTest(database);
const { http } = fixtureHttp();
const { logger } = testLogger();
for (const source of [nycFacdbDot, nycMetersOffstreet, njtParkingLots, njdotParkRide, jcMunicipalLots, njParcelsHudsonParking, wnyParkingLots, hobokenGarages, bayonneParkingLots,
  unionCityParkingLots, harrisonParkingCenter, njParcelsEssexParking, bloomfieldParkingLots, southOrangeParkingLots,
  nutleyParkingLots, veronaParkingLots, njParcelsBergenParking, westwoodParkingLots, oradellParkingLots]) {
  const outcome = await runSource(source, { sql, http, logger });
  if (outcome.status !== 'succeeded') throw new Error(`Seeding ${source.id} ended ${outcome.status} (${outcome.errorCode})`);
}

const app = await buildApp({ sql, logger: { level: 'info' } });
await app.listen({ port: API_PORT, host: '127.0.0.1' });

// Stand-ins for the geocoders address search calls (ADR-0013), so the smoke test calls nothing outside.
const GEOCODERS: Record<string, unknown> = {
  // NYC GeoSearch writes streets in capitals; the app shows them in proper case (WEB-11).
  '/nyc/autocomplete': {
    features: [{ properties: { label: '120 BROADWAY, New York, NY, USA', gid: 'nycpad:address:smoke-120' }, geometry: { coordinates: [-74.010542, 40.708233] } }],
  },
  '/nj/suggest': { suggestions: [{ text: '174 Newark Avenue, Jersey City, NJ, 07302', magicKey: 'smoke-174' }] },
  '/nj/findAddressCandidates': { candidates: [{ location: { x: -74.045042, y: 40.721587 } }] },
};

createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname;
  response.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(GEOCODERS[path] ?? STYLE));
}).listen(STYLE_PORT, '127.0.0.1');

console.log(`Smoke-test stack ready: API on ${API_PORT} (${database.kind}), map style on ${STYLE_PORT}`);

// With TEST_DATABASE_URL, the stack has a database of its own on that server; drop it when Playwright stops us.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void Promise.allSettled([app.close(), sql.end()])
      .then(() => database.stop())
      .finally(() => process.exit(0));
  });
}
