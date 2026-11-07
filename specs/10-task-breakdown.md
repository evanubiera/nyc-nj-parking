# 10 Task breakdown

Each task lists the requirement IDs it meets. Tests are named after those IDs. A task is Done when its tests pass in CI conditions (real PostGIS) and the specs match the code.

## Slice 0: foundation

| Task | What | Requirements | Status |
|---|---|---|---|
| S0-1 | Docs baseline: specs 01–06 and 10, ADRs 0001–0008, open questions, CLAUDE.md, README | — | Done (ADRs accepted by the user on 2026-11-03) |
| S0-2 | Workspace and tooling: pnpm workspace, shared TypeScript config, ESLint (including the import-boundary rules), Vitest | FND-6, WEB-3 | Done |
| S0-3 | Contract and generated types: api/openapi.yaml with `getHealth` and the error schema, Redocly lint with the `x-requirements` rule, packages/api-client | FND-1 | Done |
| S0-4 | Database: compose.yaml (PostGIS 18-3.6), packages/db (connection, migration runner, `0001_foundation.sql`, test helper with the PGlite fallback) | FND-5 | Done |
| S0-5 | API skeleton: Fastify from the contract, the error format, `GET /api/health`, request logs without query strings | FND-2, FND-3, FND-4, PRIV-1, PRIV-2 | Done |
| S0-6 | Ingestion skeleton: source registry, upstream HTTP client, snapshots, run log, failure handling, unchanged detection, scheduler, and CLI | ING-1 to ING-7 | Done |
| S0-7 | Web shell: Vite + React, react-intl catalog, layer lint rules, the health status through all layers, the disclaimer placeholder on every page | WEB-1, WEB-2, WEB-3, ATT-1 | Done |
| S0-8 | CI: GitHub Actions running lint, typecheck, tests (with a PostGIS service container), and build | All slice 0 | Done (first run passed 2026-11-03) |
| S0-9 | Slice 0 check from a fresh clone, and a status update here | — | Done 2026-11-03, from a clean copy |

### Slice 0 status (2026-11-03)

Checked from a clean copy of the files git would track: `pnpm install --frozen-lockfile` (which also generates the client), `pnpm lint`, `pnpm typecheck`, `pnpm test` (55 tests: api-client 2, db 4, api 19, worker 16, web 14), and `pnpm build`. All passed.

Also checked by running it: migrations against a PGlite + PostGIS stand-in on port 5434 (applied once, then "none pending"); the API answering `GET /api/health` with 200, and 503 once the database stopped; the API's log lines carrying only method, route, status, and duration, even for a request with `lat`/`lng` in the query; the web app at 360 px wide and in dark mode, with the skip link, the disclaimer placeholder, and both service states.

Not checked at the time:
- The database tests against real PostGIS. Docker Desktop isn't installed, so they ran on the PGlite fallback only. **Since checked:** CI ran them against `postgis/postgis:18-3.6` on 2026-11-03 (see slice 1 status).
- The CI workflow itself, since there's no GitHub repository yet.
- `pnpm dev` as written, because it starts Docker.

Ports are 8180 (API) and 5180 (web), so this project can run next to gear-rental, which uses 8080 and 5173.

## Slice 1: NYC DOT garages and fields

Drafts reviewed by the user on 2026-11-03 (see specs/02, Recommendations).

| Task | What | Requirements | Status |
|---|---|---|---|
| S1-1 | Contract: `getRecommendations` and `listSources`, from the reviewed shapes in specs/05-api.md | FND-1, REC-1 to REC-4, REC-6, ATT-3 | Done |
| S1-2 | Facility schema: `source_record`, `facility`, `facility_source`, `facility_meter_period`, `facility_hours`, `facility_rate` (specs/03) | REC-4, ING-8 | Done |
| S1-3 | Adapter `nyc-facdb-dot`, with a saved fixture; admitted in specs/06 | ING-6, ATT-2 | Done |
| S1-4 | Adapter `nyc-meters-offstreet`, plus a parser for `meter_hours` into meter periods (days, times, time limit, vehicle class), keeping the original text; values that don't parse add no period. Admitted in specs/06 | ING-6, REC-4 | Done |
| S1-5 | Matching across the two sources by name and distance, giving one facility with both sources. The limit is 750 m, not the 150 m first planned: correct matches on 2026-11-03 were up to 497 m apart (specs/03, "How facilities are built") | REC-4, ATT-2 | Done |
| S1-6 | Withdrawals, snapshot retention, and the guard against empty or unreadable data | ING-8, ING-9, ING-10 | Done |
| S1-7 | `getRecommendations`: rounding, the PostGIS query, distance rounding, the coverage check, facilities without hours, 503 when the database is down, and a performance test with 5,000 facilities | REC-1 to REC-6, PRIV-3 | Done |
| S1-8 | `listSources` and the Sources page | ATT-3 | Done |
| S1-9a | Web: device location, radius, results list with metered hours labelled as such, unknown hours with the operator's link, credits per result, Sources page | WEB-4, WEB-5, WEB-6, PRIV-3, ATT-2, ATT-3 | Done |
| S1-9b | Web: the map (MapLibre, style from `VITE_MAP_STYLE_URL`, OpenFreeMap for now), numbered result markers matching the cards, and searching by tapping it | WEB-4, WEB-5, WEB-7 | Done |
| S1-10 | Playwright smoke test on an emulated phone, against its own stack seeded from the saved fixtures, with axe checks in a real browser | All slice 1 | Done |

### Slice 1 status (2026-11-03)

Checked from a clean copy: `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (160 tests: web 50, worker 61, api 42, db 5, api-client 2, on the PGlite fallback), and `pnpm build`. Then, against a PGlite + PostGIS stand-in, a live ingest of both sources from NYC Open Data: 35 Facilities Database records and 29 meter groups became 38 facilities, and a second meters run was `unchanged`. In the browser at phone width: a search near Avenue M (metered hours with both limits, both sources credited), a search near Delancey and Essex (hours unknown, the link to DOT's Manhattan section), and the Sources page in dark mode. The request sent `lat=40.618&lng=-73.959`, rounded from the device's position, and the API's request log had no coordinates.

The first live ingest found a bug the tests had missed: postgres.js sent a string array as plain text in a connection's first query. Fixed with `textArray` (packages/db), a regression test on a fresh connection, and a lint rule.

The map (S1-9b), checked in the browser at phone width with live data and OpenFreeMap tiles: the credits in the corner, the control labels from the catalog, a tap in Astoria sending `lat=40.771&lng=-73.912` and showing five fields with markers numbered like the cards, and a marker tap moving to its card. The first run found that MapLibre's worker didn't load under Vite (it looks for the worker next to its own module); fixed with `setWorkerUrl` and a `?url` import of the worker.

The smoke test (S1-10, `pnpm test:e2e`): five tests on an emulated Pixel 7, all passing locally in about 8 seconds. Its axe checks run in a real browser, so they include colour contrast, which jsdom can't check. They found two problems, both fixed: the operator-page link's spoken name didn't start with its visible text (WCAG 2.5.3), and the map was two landmarks with the same name.

**CI, 2026-11-03** ([run 41697302747](https://github.com/evanubiera/nyc-nj-parking/actions/runs/41697302747), commit b3264ba): both jobs passed against `postgis/postgis:18-3.6`. The `check` job ran lint, typecheck, all 171 tests (web 61, worker 61, api 42, db 5, api-client 2), and the build. The `e2e` job's stack reported `(postgres)`, and its 5 smoke tests passed. So every database test has now passed on real PostGIS as well as on the PGlite fallback.

The self-hosted map tiles for production (PRIV-4, ADR-0009) are deployment work, with HOST-1.

## Slice 2: NJ commuter lots

Decided with the user on 2026-11-03: lots with no recorded owner are left out (PRD-4); lots shared by NJ Transit and a town go under NJ Transit, and lots recorded as part private are left out; NJDOT's lots are included and merged with NJ Transit's within 100 m; both adapters are built and tested now, and run only once the SRC-2 and SRC-3 requests are sent (ADR-0011). Rules and counts are in specs/06, "New Jersey adapters".

| Task | What | Requirements | Status |
|---|---|---|---|
| S2-1 | Specs: requirements, sources, data model, API, and these tasks; PRD-4 recorded | — | Done |
| S2-2 | Migration `0003_nj_lots.sql`: `lot_number` on `source_record` and `facility`, `withheld_reason` on `source_record` | REC-8, ING-11 | Done |
| S2-3 | ArcGIS fetching: item to service to layer, one query, the layer's data date, and failing a cut-short response | ING-2, ING-5 | Done |
| S2-4 | Adapter `njt-parking-lots`, with saved fixtures: exclusions, withheld private lots, owner mapping, centroids, lot numbers, official pages | ING-10, ING-11, REC-8, ATT-2 | Done |
| S2-5 | Adapter `njdot-park-ride`, with saved fixtures: duplicate names, operator, official page | ING-10, ATT-2 | Done |
| S2-6 | Matching: same region only; NJ Transit and NJDOT within 100 m; facilities with a withheld record aren't published | ING-11, ING-12 | Done |
| S2-7 | API: the `operatorType` filter, and `lotNumber` in results | REC-7, REC-8 | Done |
| S2-8 | Web: the operator filter, and lot numbers on cards and map markers | WEB-8, REC-8 | Done |
| S2-9 | Smoke test: the e2e stack also loads both NJ fixtures; a search at an NJ station, and the filter | All slice 2 | Done |
| S2-10 | Admission: once the user has sent the SRC-2 and SRC-3 requests, add both adapters to the registry, mark them Admitted, terms pending with the date asked, show "terms pending" on the Sources page, and update the search intro | ING-6, ATT-3 | Waiting for the requests |

### Slice 2 status (2026-11-03)

Built and checked, except S2-10, which waits for the user to send the SRC-2 and SRC-3 requests.

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (210 tests: web 71, worker 85, api 47, db 5, api-client 2, on the PGlite fallback), `pnpm build`, and `pnpm test:e2e` (6 smoke tests) all passed.
- From the saved fixtures: NJ Transit's 511 rows give 399 published lots and 32 withheld; NJDOT's 17 give 16 records, 4 of them merged into NJ Transit lots (Beverwyck stays hidden), so 411 NJ facilities.
- In the browser at phone width, against the smoke-test stack: near Morristown station, "Morristown, lot 1" (transit agency) and "lot 2" (city-run) showed, and lot 3, recorded as part private, didn't. At 10 km, 20 lots; with City-run and Transit agency unchosen, only NJDOT's Route 46 and Waterview Boulevard lot, on the list and the map. Checked in dark mode too. The stack's request logs had no coordinates.
- `pnpm dev` applied `0003_nj_lots` on restart and still serves the 38 NYC facilities. NJ data isn't in it until S2-10.

## Slice 4: Jersey City first (ADR-0012)

Decided with the user on 2026-11-04: show Jersey City's 7 city lots now, without hours or rates, plus the 25 candidate sites from the State's parcel layer with no other obvious use, marked unconfirmed. The request to the Parking Division (SRC-5) is drafted but not sent; its answer can confirm or drop sites later.

| Task | What | Requirements | Status |
|---|---|---|---|
| S4-1 | Specs, ADR-0012, and migration `0004_unconfirmed_sites.sql`: `confirmed`, operator type `unknown`, nullable operator name and official page | REC-9 | Done |
| S4-2 | Adapter `jc-municipal-lots` (OpenDataSoft), with a saved fixture | ING-6, ATT-2 | Done |
| S4-3 | Adapter `nj-parcels-jc-parking`: two queries, sites from touching parcels, the kept-site rule, unconfirmed records, with saved fixtures | ING-2, ING-13 | Done |
| S4-4 | Matching: Jersey City candidate sites within 90 m of a city or NJ Transit lot | ING-14 | Done |
| S4-5 | API: `confirmed`, nullable operator name and official page, operator type `unknown` | REC-7, REC-9 | Done |
| S4-6 | Web: the unconfirmed label on cards and map labels, no link, "Owner not recorded" in the filter | WEB-8, WEB-9 | Done |
| S4-7 | Smoke test and a browser check in Jersey City | All slice 4 | Done |
| S4-8 | Web: directions links on every result, in Google Maps, Apple Maps, and Waze (asked for by the user on 2026-11-04, for drivers) | WEB-10, PRIV-1 | Done |
| S4-9 | Web: unconfirmed sites get a checkbox of their own, "Show unconfirmed sites (from tax records)", instead of a "Run by" option (asked for by the user on 2026-11-04) | WEB-9 | Done |
| S4-10 | Address search with suggestions: a built-in list of 564 NJ towns and 296 NYC boroughs and neighbourhoods (scripts/build-places.ts), NYC GeoSearch and NJ_Geocode for addresses, called from the browser; ADR-0013 (asked for by the user on 2026-11-06) | WEB-11, PRIV-5, PRIV-3 | Done |
| S4-11 | Tests: each Vitest run gets its own database on TEST_DATABASE_URL, because `pnpm test` runs packages at once and they emptied each other's tables in CI (run 42313251786, 2026-11-06) | FND-5 | Done |
| S4-12 | West New York's 9 metered lots with spaces, meter hours, and rates from the Parking Utility's page (`wny-parking-lots`, held until SRC-10 is asked); rates on source records (migration 0005); `spaces` in the API; rates and spaces in the web app (asked for by the user on 2026-11-06); live since 2026-11-06 under ADR-0014 | REC-10, WEB-12, ING-10 | Done |

### Slice 4 status, Jersey City (2026-11-04)

- `pnpm lint`, `pnpm typecheck`, `pnpm test` (229 tests: web 79, worker 94, api 49, db 5, api-client 2, on the PGlite fallback), `pnpm build`, and `pnpm test:e2e` (8 smoke tests) all passed.
- From the live sources and the saved fixtures alike: the city's 7 lots, and 26 candidate sites kept from 139 parcels. Three sites merge into city lots 33, 44, and 49, so 30 Jersey City facilities: 7 confirmed, 23 unconfirmed.
- In the browser at phone width, near Lot 52 downtown: 9 places within 2 km, Lot 52 first (city-run, with the city's Parking page link and its 2020 data date), then 8 unconfirmed sites, each with the unconfirmed label, "Owner not recorded", no link, a dashed map marker, and "Check the signs on site before you park". The Sources page lists both new sources and what we change.
- `pnpm dev` applied `0004_unconfirmed_sites` on restart. The two sources were loaded into its database with `pnpm ingest`, because `pnpm dev` loads data only into an empty database.
- On a phone, the search controls now push the map below the first screen; the smoke test scrolls to it.
