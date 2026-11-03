# 10 Task breakdown

Each task lists the requirement IDs it meets. Tests are named after those IDs. A task is Done when its tests pass in CI conditions (real PostGIS) and the specs match the code.

## Slice 0: foundation

| Task | What | Requirements | Status |
|---|---|---|---|
| S0-1 | Docs baseline: specs 01–06 and 10, ADRs 0001–0008, open questions, CLAUDE.md, README | — | Done (ADRs accepted by the user on 2026-11-03) |
| S0-2 | Workspace and tooling: pnpm workspace, shared TypeScript config, ESLint (including the import-boundary rules), Vitest | FND-6, WEB-3 | Done |
| S0-3 | Contract and generated types: api/openapi.yaml with `getHealth` and the error schema, Redocly lint with the `x-requirements` rule, packages/api-client | FND-1 | Done |
| S0-4 | Database: compose.yaml (PostGIS 18-3.6), packages/db (connection, migration runner, `0001_foundation.sql`, test helper with the PGlite fallback) | FND-5 | Tests pass on PGlite; waiting on a real PostGIS run |
| S0-5 | API skeleton: Fastify from the contract, the error format, `GET /api/health`, request logs without query strings | FND-2, FND-3, FND-4, PRIV-1, PRIV-2 | Tests pass on PGlite; waiting on a real PostGIS run |
| S0-6 | Ingestion skeleton: source registry, upstream HTTP client, snapshots, run log, failure handling, unchanged detection, scheduler, and CLI | ING-1 to ING-7 | Tests pass on PGlite; waiting on a real PostGIS run |
| S0-7 | Web shell: Vite + React, react-intl catalog, layer lint rules, the health status through all layers, the disclaimer placeholder on every page | WEB-1, WEB-2, WEB-3, ATT-1 | Done |
| S0-8 | CI: GitHub Actions running lint, typecheck, tests (with a PostGIS service container), and build | All slice 0 | Written, not run (no GitHub repository yet) |
| S0-9 | Slice 0 check from a fresh clone, and a status update here | — | Done 2026-11-03, from a clean copy |

### Slice 0 status (2026-11-03)

Checked from a clean copy of the files git would track: `pnpm install --frozen-lockfile` (which also generates the client), `pnpm lint`, `pnpm typecheck`, `pnpm test` (55 tests: api-client 2, db 4, api 19, worker 16, web 14), and `pnpm build`. All passed.

Also checked by running it: migrations against a PGlite + PostGIS stand-in on port 5434 (applied once, then "none pending"); the API answering `GET /api/health` with 200, and 503 once the database stopped; the API's log lines carrying only method, route, status, and duration, even for a request with `lat`/`lng` in the query; the web app at 360 px wide and in dark mode, with the skip link, the disclaimer placeholder, and both service states.

Not checked yet:
- The database tests against real PostGIS. Docker Desktop isn't installed, so they ran on the PGlite fallback only. CI runs them against `postgis/postgis:18-3.6`.
- The CI workflow itself, since there's no GitHub repository yet.
- `pnpm dev` as written, because it starts Docker.

Ports are 8180 (API) and 5180 (web), so this project can run next to gear-rental, which uses 8080 and 5173.

## Slice 1: NYC DOT garages and fields

Drafts reviewed by the user on 2026-11-03 (see specs/02, Recommendations).

| Task | What | Requirements | Status |
|---|---|---|---|
| S1-1 | Contract: `getRecommendations` and `listSources`, from the reviewed shapes in specs/05-api.md | FND-1, REC-1 to REC-4, REC-6, ATT-3 | Done |
| S1-2 | Facility schema: `source_record`, `facility`, `facility_source`, `facility_meter_period`, `facility_hours`, `facility_rate` (specs/03) | REC-4, ING-8 | Tests pass on PGlite |
| S1-3 | Adapter `nyc-facdb-dot`, with a saved fixture; admitted in specs/06 | ING-6, ATT-2 | Tests pass on PGlite |
| S1-4 | Adapter `nyc-meters-offstreet`, plus a parser for `meter_hours` into meter periods (days, times, time limit, vehicle class), keeping the original text; values that don't parse add no period. Admitted in specs/06 | ING-6, REC-4 | Tests pass on PGlite |
| S1-5 | Matching across the two sources by name and distance, giving one facility with both sources. The limit is 750 m, not the 150 m first planned: correct matches on 2026-11-03 were up to 497 m apart (specs/03, "How facilities are built") | REC-4, ATT-2 | Tests pass on PGlite |
| S1-6 | Withdrawals, snapshot retention, and the guard against empty or unreadable data | ING-8, ING-9, ING-10 | Tests pass on PGlite |
| S1-7 | `getRecommendations`: rounding, the PostGIS query, distance rounding, the coverage check, facilities without hours, 503 when the database is down, and a performance test with 5,000 facilities | REC-1 to REC-6, PRIV-3 | Tests pass on PGlite |
| S1-8 | `listSources` and the Sources page | ATT-3 | Tests pass on PGlite |
| S1-9a | Web: device location, radius, results list with metered hours labelled as such, unknown hours with the operator's link, credits per result, Sources page | WEB-4, WEB-5, WEB-6, PRIV-3, ATT-2, ATT-3 | Done |
| S1-9b | Web: the map (MapLibre, style from `VITE_MAP_STYLE_URL`, OpenFreeMap for now), numbered result markers matching the cards, and searching by tapping it | WEB-4, WEB-5, WEB-7 | Done |
| S1-10 | Playwright smoke test on an emulated phone, against its own stack seeded from the saved fixtures, with axe checks in a real browser | All slice 1 | Done (locally, on PGlite) |

### Slice 1 status (2026-11-03)

Checked from a clean copy: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (160 tests: web 50, worker 61, api 42, db 5, api-client 2, on the PGlite fallback), and `pnpm build`. Then, against a PGlite + PostGIS stand-in, a live ingest of both sources from NYC Open Data: 35 Facilities Database records and 29 meter groups became 38 facilities, and a second meters run was `unchanged`. In the browser at phone width: a search near Avenue M (metered hours with both limits, both sources credited), a search near Delancey and Essex (hours unknown, the link to DOT's Manhattan section), and the Sources page in dark mode. The request sent `lat=40.618&lng=-73.959`, rounded from the device's position, and the API's request log had no coordinates.

The first live ingest found a bug the tests had missed: postgres.js sent a string array as plain text in a connection's first query. Fixed with `textArray` (packages/db), a regression test on a fresh connection, and a lint rule.

The map (S1-9b), checked in the browser at phone width with live data and OpenFreeMap tiles: the credits in the corner, the control labels from the catalog, a tap in Astoria sending `lat=40.771&lng=-73.912` and showing five fields with markers numbered like the cards, and a marker tap moving to its card. The first run found that MapLibre's worker didn't load under Vite (it looks for the worker next to its own module); fixed with `setWorkerUrl` and a `?url` import of the worker.

The smoke test (S1-10, `pnpm test:e2e`): five tests on an emulated Pixel 7, all passing locally in about 8 seconds. Its axe checks run in a real browser, so they include colour contrast, which jsdom can't check. They found two problems, both fixed: the operator-page link's spoken name didn't start with its visible text (WCAG 2.5.3), and the map was two landmarks with the same name.

Not checked yet: real PostGIS (no Docker) and CI (no remote; the workflow now has an `e2e` job too).

The self-hosted map tiles for production (PRIV-4, ADR-0009) are deployment work, with HOST-1.
