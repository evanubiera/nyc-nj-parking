# 10 Task breakdown

Each task lists the requirement IDs it meets. Tests are named after those IDs. A task is Done when its tests pass in CI conditions (real PostGIS) and the specs match the code.

## Slice 0: foundation

| Task | What | Requirements | Status |
|---|---|---|---|
| S0-1 | Docs baseline: specs 01–06 and 10, ADRs 0001–0008, open questions, CLAUDE.md, README | — | Done (ADRs are Proposed, waiting on review) |
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

## Slice 1: NYC DOT garages and fields (draft, for review)

| Task | What | Requirements |
|---|---|---|
| S1-1 | Contract: `getRecommendations` and `listSources`, from the draft in specs/05-api.md after review | FND-1, REC-1 to REC-4, ATT-3 |
| S1-2 | Facility schema: `facility`, `facility_source`, `facility_hours`, `facility_rate` (specs/03) | REC-4, ING-8 |
| S1-3 | Adapter `nyc-facdb-dot`, with a saved fixture; admit it in specs/06 | ING-6, ATT-2 |
| S1-4 | Adapter `nyc-meters-offstreet`, plus a parser for `meter_hours` into weekly periods, keeping the original text; admit it in specs/06 | ING-6, REC-4 |
| S1-5 | Matching across the two sources by normalized name and distance under 150 m, giving one facility with both sources | REC-4, ATT-2 |
| S1-6 | Withdrawals and snapshot retention | ING-8, ING-9 |
| S1-7 | `getRecommendations`: rounding, the PostGIS query, distance rounding, the coverage check, and a performance test with 5,000 facilities | REC-1 to REC-5, PRIV-3 |
| S1-8 | `listSources` and the Sources page | ATT-3 |
| S1-9 | Web: device location or a tap on the map, then a results list and a map, with credits per result. The map needs a tile provider (SRC-6); until then the list works on its own. | WEB-4, WEB-5, PRIV-3, ATT-2 |
| S1-10 | Playwright smoke test and slice 1 close | All slice 1 |
