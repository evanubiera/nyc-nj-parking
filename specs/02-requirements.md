# 02 Requirements

Each requirement has an ID. Tasks, tests, and contract operations (`x-requirements`) refer to these IDs. "Slice" is where the requirement is first met.

## Foundation (FND)

| ID | Requirement | Slice |
|---|---|---|
| FND-1 | api/openapi.yaml passes the contract lint (`pnpm lint:contract`), and each operation lists its requirement IDs in `x-requirements`. | 0 |
| FND-2 | The API registers only the operations in the contract. It validates requests against the contract and serializes responses with the contract's schemas, so fields that aren't in a schema never leave the server. | 0 |
| FND-3 | `GET /api/health` answers 200 with `status: ok` when the database responds, and 503 with `status: unavailable` when it doesn't. | 0 |
| FND-4 | Errors are JSON `{ "code": "…" }`, with codes from specs/05-api.md. The API never returns display text. | 0 |
| FND-5 | Schema changes are numbered SQL files in packages/db/migrations, applied in order and each once. All pending ones are applied in one transaction, so a failure applies none. | 0 |
| FND-6 | apps/api and apps/worker never import each other. Shared code lives in packages/. Lint enforces this. | 0 |

## Ingestion (ING)

| ID | Requirement | Slice |
|---|---|---|
| ING-1 | Only the worker calls upstream sources. No API request causes an upstream call. | 0 |
| ING-2 | Each run stores the raw upstream response as a snapshot (fetch time, SHA-256, byte size, content type) before normalizing it. | 0 |
| ING-3 | A run that fails at any step leaves facility data unchanged, and is recorded as `failed` with an error code. | 0 |
| ING-4 | Every run is recorded: source, start and end time, status, rows read, rows written, and rows withdrawn. | 0 |
| ING-5 | Upstream requests send a User-Agent that names the app and, when `CONTACT_URL` is set (required in deployment), a contact URL. They send the Socrata app token in the `X-App-Token` header for Socrata sources, and time out after 30 seconds. Tokens are never logged. | 0 |
| ING-6 | The worker runs only sources marked Admitted (including Admitted, terms pending under ADR-0011) in specs/06-sources.md. The worker's source registry is checked against that table by a test. | 0 |
| ING-7 | When a snapshot's hash matches the last successful run's snapshot, normalizing is skipped and the run is recorded as `unchanged`. | 0 |
| ING-8 | Facilities that are no longer in a source are marked withdrawn, with the time, and aren't returned by the API. | 1 |
| ING-9 | Snapshots older than the newest 10 per source are deleted. | 1 |
| ING-10 | A run whose data gives no facilities, or where rows that can't be read outnumber those that can, fails with a code and changes nothing. | 1 |
| ING-11 | A record whose owner is recorded as private (ADR-0007), or that has no recorded owner (PRD-4), isn't published. A private record is kept as withheld, so the same lot from another source isn't published either. | 2 |
| ING-12 | Records in different regions never match. An NJ Transit record and an NJDOT record within 100 m of each other are the same lot, whatever their names, and NJ Transit's record is the primary. | 2 |

## Privacy (PRIV)

| ID | Requirement | Slice |
|---|---|---|
| PRIV-1 | No table, log, or metric stores a user's coordinates or place-search text. | 0 |
| PRIV-2 | Request logs record the method, route pattern, status code, and duration, never the URL, the query string, or the request body. | 0 |
| PRIV-3 | The web app rounds coordinates to 3 decimal places before sending them. The API rounds again before using them, and doesn't echo them in responses. | 1 |
| PRIV-4 | The public app's map tiles come from our own hosting, whose logs drop tile paths as well as query strings. A third-party tile host (OpenFreeMap) is used only for development and previews (ADR-0009). | Deployment |

## Attribution and accuracy (ATT)

| ID | Requirement | Slice |
|---|---|---|
| ATT-1 | Every page shows the accuracy disclaimer. Until PRD-2 is answered, its text is a marked placeholder. | 0 |
| ATT-2 | Every facility in a response carries its source IDs, the source's data date, and a link to the official page. The web app shows them with each result. | 1 |
| ATT-3 | `GET /api/sources` and a Sources page list each admitted source: publisher, dataset link, terms link, data date, required credit text (if any), and what we change. | 1 |

## Recommendations (REC), slice 1

Reviewed by the user on 2026-11-03: metered hours are shown as metered hours, facilities without hours are still shown, the default radius is 2 km, and fields are camelCase.

| ID | Requirement | Slice |
|---|---|---|
| REC-1 | `GET /api/parking/recommendations` returns active public facilities within the radius of the given point, nearest first, at most 50. | 1 |
| REC-2 | `radius` is in meters, from 100 to 10,000, with a default of 2,000 (PRD-5, decided). A value outside that range returns 400 `request.invalid_parameter`. | 1 |
| REC-3 | A point outside the coverage area (NYC and NJ bounding boxes in specs/05-api.md) returns 422 `location.out_of_area`. | 1 |
| REC-4 | Each result has: ID, name, kind (garage, lot, or field), operator name and type, facility address, facility location, distance in meters rounded to the nearest 10, metered hours (periods with the time limit and vehicle class, plus the source's original text) when a source has them, opening hours when a source gives them (none admitted yet, SRC-1), rates when known (minor units plus currency), and its sources (ATT-2). | 1 |
| REC-5 | The 95th percentile response time is under 300 ms with 5,000 facilities in the database. | 1 |
| REC-6 | A facility with no hours from any source is still returned, with metered and opening hours both null and its official page link. | 1 |
| REC-7 | `operatorType` limits results to one or more operator types (`municipal`, `county`, `state`, `transit_agency`, `public_authority`). Without it, every type is returned. An unknown code returns 400 `request.invalid_parameter`. | 2 |
| REC-8 | When a source numbers several lots with the same name (such as an NJ Transit station's lots), each result carries its `lotNumber`, so they can be told apart. Otherwise `lotNumber` is null. | 2 |

## Web (WEB)

| ID | Requirement | Slice |
|---|---|---|
| WEB-1 | Text people see comes from the message catalogs (react-intl). There are no literal strings in JSX, and lint enforces this. | 0 |
| WEB-2 | Pages work on a 360 px wide screen and with a keyboard alone, and aim for WCAG 2.2 AA. Automated axe checks run in the component tests. | 0 |
| WEB-3 | Layers: components → hooks → services → packages/api-client. Only services call the network. Lint enforces this. | 0 |
| WEB-4 | The user can share their device location, or tap a point on the map, to search. If they decline location sharing, the app explains how to search by tapping the map. | 1 |
| WEB-5 | Results show on a list and on a map, nearest first, with each result's sources and data date. | 1 |
| WEB-6 | Metered hours are labelled as metered hours with their time limit, never as opening hours. When hours are unknown, the result says so and links to the official page. | 1 |
| WEB-7 | The map shows the attribution its tile source requires, including credit to OpenStreetMap linked to its copyright and licence page, in a corner of the map. The map style comes from configuration (`VITE_MAP_STYLE_URL`), not code; without it there's no map (ADR-0009). | 1 |
| WEB-8 | The user can limit results to chosen operator types. Every type is chosen at first. The choice applies to the list and the map, and is kept in memory only. With none chosen, the app asks for at least one and doesn't search. A result with a lot number shows it with its name, on the card and the map. | 2 |
