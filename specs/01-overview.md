# 01 Overview

## What it is

A public web app, usable on phones, that suggests public parking near the user across New York State and New Jersey (ADR-0022): garages, lots, and fields run by a city, county, state, or transit agency. It answers "where's the nearest public parking, and what are its hours and rates?" A suggestion isn't a guarantee that a space is free, open, or legal to use. The app says so on every page (ADR-0008).

## Who uses it

- Drivers in or heading to NYC, New Jersey, or the rest of New York State who want public parking rather than private garages.
- Commuters looking for a park-and-ride lot near a train or bus (from slice 2).

There are no accounts. Anyone can use it without signing in.

## How it works

A scheduled worker pulls public data from city and state portals, keeps a snapshot of each pull, and normalizes everything into one schema in PostgreSQL/PostGIS. The API answers `GET /api/parking/recommendations?lat=…&lng=…&radius=…` from that database only. It never calls an upstream portal during a request (ADR-0005). The user's location is rounded before it leaves the device, and it's never stored or logged (ADR-0006).

## In scope

- Off-street public parking (garages, lots, fields) run by a public agency (ADR-0007).
- Hours and rates that change by time of day and day of the week, where a source provides them.
- Each result's source and data date (ADR-0008).

## Out of scope for now

- On-street parking, meter rates by block, and alternate-side rules (later slices).
- Real-time space availability. No source we checked publishes it (specs/06-sources.md).
- Reservations and payments.
- Private garages and lots.
- Native mobile apps. The web app is built to work well on phones first.

## Slices

| Slice | What a user can do at the end | Status |
|---|---|---|
| 0 | Nothing user-facing yet: the foundation (repo, contract, database, ingestion skeleton, web shell, CI). | Done |
| 1 | Find NYC DOT municipal garages and fields near them, nearest first, on a list and a map, with hours, sources, and the disclaimer. | Done |
| 2 | Also find NJ commuter lots (NJ Transit and NJDOT), filtered by operator type. Both live since 2026-11-10, without asking first (ADR-0014); PRD-4 decided. | Done |
| 3 | See rates and an "open now" filter. Rates depend on SRC-1. | Planned |
| 4 | More NJ municipalities, one city at a time, plus state-run lots if PRD-3 includes them. Jersey City first: its 7 city lots, and unconfirmed sites from tax records (ADR-0012). Then West New York's 9 lots (ADR-0014), Hoboken's garages, and unconfirmed sites in all of Hudson County (ADR-0015); Bayonne, Union City, and Harrison; then Essex County, with Bloomfield's, South Orange's, Nutley's, and Verona's lots (ADR-0018); then Bergen County, with Westwood's and Oradell's lots (ADR-0019); then unconfirmed sites in the other 18 counties (ADR-0020). | In progress |
| 5 | All of New York State (ADR-0022, PRD-3 decided): the Thruway's commuter lots, unconfirmed sites from the State's public tax parcels, and New York's counties and towns in search; then NYSDOT's park-and-rides and cities' own lot pages. | In progress |
| Later | On-street parking; a native app if needed. | — |

## Spec index

- [02 Requirements](02-requirements.md): requirement IDs used in tasks, tests, and the contract.
- [03 Data model](03-data-model.md): tables, and the draft facility schema for slice 1.
- [04 Architecture](04-architecture.md): components, rules between them, logging, local development, and testing.
- [05 API](05-api.md): conventions, error codes, and operations, including the slice 1 draft.
- [06 Sources](06-sources.md): the verified source inventory and which sources are admitted.
- [10 Task breakdown](10-task-breakdown.md): the tasks for slices 0 to 2.
- ADRs: [docs/adr](../docs/adr/README.md). Open questions: [docs/open-questions.md](../docs/open-questions.md).
