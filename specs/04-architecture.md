# 04 Architecture

## Components

```
upstream portals ──(scheduled HTTPS)──▶ apps/worker ──(SQL)──▶ PostgreSQL + PostGIS
                                                                     ▲
                       browser ──(HTTPS JSON /api)──▶ apps/api ──(SQL, read-only)
                          ▲    └──(map tiles)──▶ OpenFreeMap now; our own hosting in production (ADR-0009)
                     apps/web (static files)
```

| Package | What it is | May import |
|---|---|---|
| apps/api | Fastify 5 server. Routes come from api/openapi.yaml through fastify-openapi-glue (ADR-0004). It only reads facility data. | packages/db, packages/api-client (types only) |
| apps/worker | The scheduler and the ingestion CLI. Source adapters live in `src/sources/`. | packages/db |
| apps/web | React 19 + Vite 8, built to static files. | packages/api-client (in `src/services/` only) |
| packages/db | The connection factory, migration runner, migrations, and the test database helper. | — |
| packages/api-client | Types generated from the contract, plus a small openapi-fetch wrapper. | — |

Rules:
- apps/api and apps/worker never import each other (FND-6). ESLint blocks it.
- apps/api can't use `fetch` or HTTP client modules (ING-1). ESLint blocks it.
- In apps/web: components → hooks → services → packages/api-client. Only services call the network (WEB-3). ESLint blocks `fetch` and api-client imports outside services. The one exception is MapLibre fetching map tiles, glyphs, and sprites from the configured style (ADR-0009); it never calls our API.

## Request flow (slice 1)

1. The browser gets a location (device location or a tap on the map) and rounds it to 3 decimal places (PRIV-3).
2. `GET /api/parking/recommendations?lat=40.719&lng=-73.988&radius=2000`.
3. The API validates the request against the contract, rounds again, and runs one PostGIS query (`ST_DWithin` on geography, ordered by `<->`). It rounds distances to 10 m and serializes with the response schema.
4. No upstream calls happen during the request (ING-1).

## Ingestion flow

For each admitted source, on its schedule (ADR-0005):

1. Mark any of this source's runs left as `running` as `failed` / `run.abandoned`. Insert a new `running` row.
2. Fetch, with our User-Agent, the Socrata token header where it applies, and a 30 s timeout (ING-5).
3. If the SHA-256 matches the last successful run's snapshot, finish as `unchanged` (ING-7). Otherwise store the snapshot (ING-2).
4. In one transaction, the adapter normalizes the snapshot into source records, replaces that source's records, and rebuilds the facility tables from every source's records (specs/03, "How facilities are built"). Any error rolls the whole transaction back (ING-3).
5. Delete snapshots beyond the newest 10 for the source (ING-9).
6. Finish the run with its status, counts, and error code (ING-4).

The worker runs as one long-lived process (`pnpm --filter @parking/worker start`), using cron expressions from each source's definition. `pnpm ingest <source-id>` runs one source once.

Sources in slice 1: `nyc-facdb-dot` weekly (Mondays 04:15) and `nyc-meters-offstreet` daily (04:45), New York time. Each run makes two requests: the rows, and the dataset's metadata for its data date.

## Configuration

Environment variables only, read and checked at startup:

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | api, worker, `pnpm db:migrate` | `postgres://…` |
| `TEST_DATABASE_URL` | tests | A database the tests may empty. When it isn't set, tests use PGlite + PostGIS in-process. Never the development database. |
| `PORT` | api | Default 8180 |
| `LOG_LEVEL` | api, worker | Default `info` |
| `SOCRATA_APP_TOKEN` | worker | Optional locally, required in deployment. Never logged. |
| `CONTACT_URL` | worker | Goes in the User-Agent (ING-5). Optional locally, required in deployment. |
| `VITE_MAP_STYLE_URL` | web (build time) | The map's style JSON (ADR-0009). Set to OpenFreeMap's Positron style in apps/web/.env.development, which is committed and used only by `vite` in development. Production builds set our own self-hosted Protomaps style; until then they have no map. |

## Logging

pino, JSON lines.

- The API's request log has `method`, `route` (the pattern, such as `/api/parking/recommendations`), `statusCode`, and `responseTime`. It never has the URL, query string, headers, or body (PRIV-2). A test checks this.
- The worker logs the source ID, run ID, status, counts, and error codes. It never logs request headers (the token) or response bodies.
- There's no logging that would capture coordinates or place-search text (PRIV-1).

## Local development

- `pnpm install`: installs everything and generates packages/api-client.
- `pnpm dev` (scripts/dev.ts, ADR-0010): uses a database already on port 5434, or Docker's PostGIS from compose.yaml if Docker is running, or else PGlite with PostGIS saved in `.data/pglite`. It runs the migrations, loads each admitted source if there are no facilities yet (from the source, or its saved copy if that can't be reached), then runs the API on :8180 and the web app on :5180. Vite proxies `/api` to the API. `DEV_DATABASE=docker|pglite` forces a choice. The ports differ from the usual 8080 and 5173 so this project can run next to the gear-rental project.
- `pnpm test`: Vitest in every package. Database tests use `TEST_DATABASE_URL` if it's set, otherwise PGlite + PostGIS in-process (ADR-0003).

## Testing

- Unit and component tests: Vitest. Web component tests use Testing Library and axe (WEB-2).
- Database tests: real PostGIS in CI (a GitHub Actions service container). PGlite is only the local fallback.
- Contract: Redocly lint, plus a test that every contract operation has a handler and no handler exists without an operation (FND-2).
- Source adapters (slice 1): saved fixtures from the real sources, never live calls in tests.
- Smoke test (`pnpm test:e2e`, e2e/): Playwright on an emulated phone. e2e/stack.ts starts a fresh database, ingests both sources through the real worker code from the saved fixtures, starts the real API on port 8181, and serves a one-layer map style on 8182; Vite runs on 5181 with `API_ORIGIN` and `VITE_MAP_STYLE_URL` pointing at them. So it calls neither NYC Open Data nor a tile host. Axe runs in the real browser there, including colour contrast. Needs Playwright's Chromium once: `pnpm --filter @parking/e2e exec playwright install --only-shell chromium`.

## Deployment

Not decided (HOST-1). Requirements for whichever host we choose: run the API and the worker as separate processes; managed PostgreSQL with PostGIS; object storage that serves the map's PMTiles file, glyphs, and sprites with HTTP range requests (ADR-0009); access logs without query strings (ADR-0006) or tile paths (ADR-0009); HTTPS only. A scheduled job refreshes the NYC and NJ map extract, roughly monthly.
