# ADR-0021: Searching a whole county or borough: each facility's area from simplified boundaries

- Status: Accepted (2026-11-10; the user asked to search by city or by county from dropdowns, and chose that picking a county shows every lot in it)
- Date: 2026-11-10
- Builds on: ADR-0006 (privacy), ADR-0013 (address search and the place list)

## Context

Search ran around a point: a place, an address, the device, or a tap, within a radius of up to 10 km, at most 50 results. The user asked to search by city or by county, from dropdowns, with the device's location among the choices. A city fits the point search (its centre is in the place list). A county doesn't: the largest are 60 km across, and the user chose to see every facility in it, by town.

Facilities record their town as each source writes it ("Morristown Town", "Fair Lawn Borough", "Westwood"), not their county, and sources name towns differently, so a town name can't be turned into a county reliably. Where a facility is is reliable.

## Decision

- **Areas** are New Jersey's 21 counties and New York City's 5 boroughs, named `nj-<county>` and `ny-<borough>` (`AreaId` in the contract).
- **Their outlines** come from NJOGIS (County Boundaries of NJ) and NYC Planning (Borough Boundaries, with water areas, so a pier is in its borough), simplified to about 20 m by `scripts/build-areas.ts` into a file in the worker (270 KB), as the place list is built for address search. They change rarely; the script is run again when they do.
- **Each facility's area** is set by the worker when it rebuilds the facilities: the outline it's inside, or else the nearest within 1.5 km (a beach or pier the simplified coast misses); otherwise none. `pnpm rebuild` rebuilds without fetching, so the change reaches existing facilities at once.
- **The API** lists an area's facilities at `GET /api/parking/areas/{area}/facilities`, sorted by town, then name, up to 1,000 (Essex has the most, 110), with the operator filter. Results keep their shape; `distanceMeters` is null, as there's no point. A county search sends nothing about where the person is.
- **The web app** has a "Search by" dropdown: a town or address (the default), a city (a county or borough, then one of its towns or neighbourhoods from the place list, searched around with the radius), a whole county or borough, and the device's location. Choosing the device's location opens the consent dialog, as the button did (WEB-4).

## Consequences

- People can browse a county or borough without sharing or typing a location.
- A facility right on a county line can be put in the neighbouring county, within the 20 m simplification.
- A new kind of build-time data (the outlines) sits beside the place list; neither is a facility source, and neither is fetched at run time.
- The location button moves into "Search by"; once someone has shared their location in a visit, choosing it searches straight away, as before.
