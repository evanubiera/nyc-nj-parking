// The smoke test's own stack (S1-10, S2-9), in one process. A fresh database (TEST_DATABASE_URL, or PGlite +
// PostGIS in-process), the NYC and NJ sources ingested through the real worker code from the saved fixtures
// (no upstream calls), the real API, and a one-layer map style, so no tile host is called. The NJ sources
// aren't admitted yet (S2-10); loading their fixtures into this throwaway database is testing, not ingesting.
import { createServer } from 'node:http';
import { connectTest, startTestDatabase } from '@parking/db/testing';
import { buildApp } from '../apps/api/src/app.ts';
import { runSource } from '../apps/worker/src/run.ts';
import { njdotParkRide } from '../apps/worker/src/sources/njdot-park-ride.ts';
import { njtParkingLots } from '../apps/worker/src/sources/njt-parking-lots.ts';
import { nycFacdbDot } from '../apps/worker/src/sources/nyc-facdb-dot.ts';
import { nycMetersOffstreet } from '../apps/worker/src/sources/nyc-meters-offstreet.ts';
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
for (const source of [nycFacdbDot, nycMetersOffstreet, njtParkingLots, njdotParkRide]) {
  const outcome = await runSource(source, { sql, http, logger });
  if (outcome.status !== 'succeeded') throw new Error(`Seeding ${source.id} ended ${outcome.status} (${outcome.errorCode})`);
}

const app = await buildApp({ sql, logger: { level: 'info' } });
await app.listen({ port: API_PORT, host: '127.0.0.1' });

createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
  response.end(JSON.stringify(STYLE));
}).listen(STYLE_PORT, '127.0.0.1');

console.log(`Smoke-test stack ready: API on ${API_PORT} (${database.kind}), map style on ${STYLE_PORT}`);
