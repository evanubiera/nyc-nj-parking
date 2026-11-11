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
| ING-2 | Each run stores the raw upstream response as a snapshot (fetch time, SHA-256, byte size, content type) before normalizing it. An HTML page's email addresses are removed first (Hoboken's page lists staff addresses). | 0 |
| ING-3 | A run that fails at any step leaves facility data unchanged, and is recorded as `failed` with an error code. | 0 |
| ING-4 | Every run is recorded: source, start and end time, status, rows read, rows written, and rows withdrawn. | 0 |
| ING-5 | Upstream requests send a User-Agent that names the app and, when `CONTACT_URL` is set (required in deployment), a contact URL. They send the Socrata app token in the `X-App-Token` header for Socrata sources, and time out after 30 seconds. Tokens are never logged. | 0 |
| ING-6 | The worker runs only sources marked Admitted (including Admitted, terms pending under ADR-0011, and Admitted, terms unstated under ADR-0014) in specs/06-sources.md. The worker's source registry is checked against that table by a test. | 0 |
| ING-7 | When a snapshot's hash matches the last successful run's snapshot, and the adapter's revision is the one that run used, normalizing is skipped and the run is recorded as `unchanged`. An adapter raises its revision when a change would normalize the same bytes differently. | 0 |
| ING-8 | Facilities that are no longer in a source are marked withdrawn, with the time, and aren't returned by the API. | 1 |
| ING-9 | Snapshots older than the newest 10 per source are deleted. | 1 |
| ING-10 | A run whose data gives no facilities, or where rows that can't be read outnumber those that can, fails with a code and changes nothing. | 1 |
| ING-11 | A record whose owner is recorded as private (ADR-0007), or that has no recorded owner (PRD-4), isn't published. A private record is kept as withheld, so the same lot from another source isn't published either. | 2 |
| ING-12 | Records in different regions never match. An NJ Transit record and an NJDOT record within 100 m of each other are the same lot, whatever their names, and NJ Transit's record is the primary. | 2 |
| ING-13 | `nj-parcels-hudson-parking`, `nj-parcels-essex-parking`, `nj-parcels-bergen-parking`, and `nj-parcels-rest-of-nj-parking` (the other 18 counties, ADR-0020) take each county's parcels in class 15C whose building description or facility name says parking (in the county's wording, ADR-0015), groups touching parcels on a block into sites, and keeps a site only when none of its parcels is railroad or right of way, or land taken for unpaid taxes (ADR-0018), "future parking", or a condominium unit (ADR-0019), or a residence, and none of its own parcels is a water works, well, Green Acres land, a museum, or a rescue squad (ADR-0020), and no public parcel on its block, its own included, is a school, public building (including a public works or maintenance building), park, playground, pool, field, tennis court, rink, or church (ADR-0012, ADR-0015, ADR-0020, specs/06), and isn't one its own town says is rented, reserved, private, or for permit holders only (ADR-0017). | 4 |
| ING-14 | A candidate site from tax records is the same lot, and the lot's record is the primary, when it's within 90 m of a Jersey City, NJ Transit, or NJDOT lot, or within 60 m of a West New York, Bayonne, Union City, Bloomfield, South Orange, Nutley, Verona, Westwood, or Oradell lot or a Hoboken or Harrison garage (those were placed on their own tax parcels). An NJ Transit lot within 50 m of an Oradell lot is that lot, and Oradell's record is the primary (specs/06). | 4 |
| ING-15 | A source transcribed by hand from a document the worker can't read, such as Bayonne's ordinance PDF, checks each run that the file's SHA-256 is the one transcribed; a different file fails the run and changes nothing, until someone checks it and updates the transcription (ADR-0016). | 4 |

## Privacy (PRIV)

| ID | Requirement | Slice |
|---|---|---|
| PRIV-1 | No table, log, or metric stores a user's coordinates or place-search text. | 0 |
| PRIV-2 | Request logs record the method, route pattern, status code, and duration, never the URL, the query string, or the request body. | 0 |
| PRIV-3 | The web app rounds coordinates to 3 decimal places before sending them. The API rounds again before using them, and doesn't echo them in responses. | 1 |
| PRIV-4 | The public app's map tiles come from our own hosting, whose logs drop tile paths as well as query strings. A third-party tile host (OpenFreeMap) is used only for development and previews (ADR-0009). | Deployment |
| PRIV-5 | Text typed into address search is sent only to the geocoders in ADR-0013, from the browser, after a pause in typing and at least three characters. It never reaches our API, storage, logs, or URLs, and suggestions are cached in memory only. | 4 |

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
| REC-4 | Each result has: ID, name, kind (garage, lot, or field), operator name and type, facility address, facility location, distance in meters rounded to the nearest 10, metered hours (periods with the time limit and vehicle class, plus the source's original text) when a source has them, opening hours when a source gives them (first, Harrison's garage, "Open 24/7", S4-22), rates when known (minor units plus currency), and its sources (ATT-2). | 1 |
| REC-5 | The 95th percentile response time is under 300 ms with 5,000 facilities in the database. | 1 |
| REC-6 | A facility with no hours from any source is still returned, with metered and opening hours both null and its official page link (unconfirmed sites have none, REC-9). | 1 |
| REC-7 | `operatorType` limits results to one or more operator types (`municipal`, `county`, `state`, `transit_agency`, `public_authority`, and from slice 4 `unknown`). Without it, every type is returned. An unknown code returns 400 `request.invalid_parameter`. | 2 |
| REC-8 | When a source numbers several lots with the same name (such as an NJ Transit station's lots), each result carries its `lotNumber`, so they can be told apart. Otherwise `lotNumber` is null. | 2 |
| REC-9 | Each result carries `confirmed`. An unconfirmed site (ADR-0012) has operator type `unknown`, no operator name, and no official page. Every confirmed result has all three. | 4 |
| REC-10 | Each result carries `spaces`, the number of spaces when a source states it (the first of its sources, in priority order, that does), and otherwise null. Rates a source states are returned as stated, in minor units, including an overnight pass (`overnight_pass`). | 4 |
| REC-11 | `GET /api/parking/areas/{area}/facilities` returns every active facility in a New Jersey county or a New York City borough (`AreaId`), sorted by town, then name, at most 1,000, each with `distanceMeters` null. It takes no point, so nothing about where the person is reaches the server. The operator type filter (REC-7) applies. A facility's area is set when the facilities are rebuilt, from simplified county and borough outlines: the outline it's inside, or else the nearest within 1.5 km, among its own state's areas only; otherwise none (ADR-0021, S4-45). | 4 |

## Web (WEB)

| ID | Requirement | Slice |
|---|---|---|
| WEB-1 | Text people see comes from the message catalogs (react-intl). There are no literal strings in JSX, and lint enforces this. | 0 |
| WEB-2 | Pages work on a 360 px wide screen and with a keyboard alone, and aim for WCAG 2.2 AA. Automated axe checks run in the component tests. | 0 |
| WEB-3 | Layers: components → hooks → services → packages/api-client. Only services call the network. Lint enforces this. | 0 |
| WEB-4 | The user can share their device location, or tap a point on the map, to search. The search box (WEB-11) is the main way in; the device's location is one of the "Search by" choices (WEB-13), and is used only after the user volunteers it in a dialog that says how it's used (rounded, for this search only, never stored). Saying "not now" asks nothing of the browser. Once they've shared it in a visit, choosing it, or its button, searches straight away; that's kept in memory only. If they decline location sharing in the browser, the app explains how to search by tapping the map. | 1 |
| WEB-5 | Results show on a list and on a map, nearest first, with each result's sources and data date. | 1 |
| WEB-6 | Metered hours are labelled as metered hours with their time limit, never as opening hours. Each result says which of its hours, rates, and number of spaces aren't shown ("Not shown here: …"), suggests checking with the operator, and links to the official page (the wording decided by the user on 2026-11-04, so a missing rate isn't taken as free). | 1 |
| WEB-7 | The map shows the attribution its tile source requires, including credit to OpenStreetMap linked to its copyright and licence page, in a corner of the map. The map style comes from configuration (`VITE_MAP_STYLE_URL`), not code; without it there's no map (ADR-0009). | 1 |
| WEB-8 | The user can limit results to chosen operator types. Every type is chosen at first. The choice applies to the list and the map, and is kept in memory only. With none chosen, the app asks for at least one and doesn't search. A result with a lot number shows it with its name, on the card and the map. | 2 |
| WEB-9 | An unconfirmed site says so on its card and in its map label: public land recorded as parking, which may be for staff or permit holders only. It has no official page link, and its operator shows as "Owner not recorded". A checkbox of its own, "Show unconfirmed sites (from tax records)", checked at first, includes or leaves them out; it replaced the "Run by" option ADR-0012 described, at the user's request on 2026-11-04, so the choice is easy to find. | 4 |
| WEB-10 | Each result links to driving directions to it in Google Maps, Apple Maps, and Waze, in each vendor's documented link format. The links carry only the facility's location, never the person's: their map app starts from their own location (PRIV-1). | 4 |
| WEB-11 | By default (WEB-13), people can type a town ("Hoboken, NJ") or an address ("174 Newark Ave, Jersey City, NJ") and choose from suggestions as they type, by keyboard or touch; choosing one searches there. Towns and neighbourhoods come from a list in the app; addresses from the state's geocoder (ADR-0013), shown in proper case: NYC GeoSearch's capitals ("350 5 AVENUE") read as "350 5th Avenue". Device location and tapping the map still work. | 4 |
| WEB-12 | A result shows its rates (per hour, up to a duration, a daily maximum, a monthly permit, or an overnight pass) with their days and times ("8:00 AM to 6:00 PM", or "around the clock" for 00:00 to 24:00), formatted as money in the locale, and its number of spaces when known. The missing-details note (WEB-6) lists only what isn't shown. | 4 |
| WEB-13 | A "Search by" dropdown offers four ways to search: a town or address (the default, WEB-11); a city, chosen from a dropdown of New Jersey's counties and New York City's boroughs and then one of the area's towns or neighbourhoods, searching around it with the chosen radius; a whole county or borough, from the same dropdown (REC-11), listed by town with a heading for each, without a radius or distances, the map fitted to the results; and the device's location (WEB-4). The dropdowns come from the place list in the app (ADR-0013), so picking from them sends nothing until a search runs. A New Jersey town is named the same whichever source a facility comes from ("Oradell Borough" from NJ Transit and "Clinton Twp" from NJDOT read as Oradell and Clinton Township, S4-44), so a town's facilities are listed together. | 4 |
