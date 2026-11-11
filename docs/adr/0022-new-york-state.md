# ADR-0022: All of New York State: the Thruway's commuter lots, and unconfirmed sites from the State's tax parcels

- Status: Accepted (2026-11-11; the user asked "can we move onto the rest of NY state?" and chose to start with the Thruway's lots and the tax parcels)
- Date: 2026-11-11
- Builds on: ADR-0007 (public operators), ADR-0012 (unconfirmed sites), ADR-0014 (unstated terms), ADR-0021 (search by area)
- Decides: PRD-3 (coverage area)

## Context

The app covered New York City and New Jersey. PRD-3 asked whether to cover all of New York State. Checked on 2026-11-10 and 2026-11-11 (specs/06):

- **State data.** data.ny.gov has the Thruway Authority's 31 commuter park-and-ride lots, under the OPEN-NY Terms of Use, which ask for no attribution and allow reuse. The State's public tax parcels (NYS ITS with the counties and ORPTS) give parking its own property classes (437, a garage; 438, a lot), and, unlike New Jersey's, name each parcel's owner and its kind (county, city, town, village, State, federal, school district, private). The layer covers the 38 counties that let the State share their parcels, and states only a disclaimer. About 890 parking parcels belong to a county, city, town, or village. A statewide list of NYSDOT's park-and-rides (422 lots) is published only from a contractor's account, with no terms.
- **Cities.** Few publish their lots as data: Albany's parking layer forbids reuse; a Yonkers layer comes from a contractor's study. As in New Jersey, cities' own pages are the way in, one at a time.
- **OpenStreetMap** has 58,369 parking areas outside NYC, few marked public; its licence question (SRC-9) is still open.

## Decision

- **Coverage** is New Jersey and all of New York State. The API checks two boxes, one per state, so the ocean south of Long Island stays outside (REC-3). The app is called "NY and NJ public parking".
- **Search** knows New York's 57 counties outside NYC as areas (ADR-0021), with their outlines from NYS GIS, and its 1,526 cities, towns, and villages as places, from NYS GIS's civil boundaries, named as New Jersey's are ("Buffalo City", "Islip Town").
- **`nys-thruway-park-ride`**: the Thruway's lots, confirmed, each with who runs it (the Thruway Authority as a public authority; NYSDOT, alone or with the Town of Clarkstown, as the State; the Niagara Frontier Transportation Authority as a transit agency) and its spaces. The Palisades Center's lot is a shopping centre's, so it's left out (ADR-0007).
- **`nys-parcels-parking`**: unconfirmed sites, one per parking parcel, or touching parcels of one owner, that a county, city, town, or village owns. Not the State's (mostly its office workers' lots in Albany), the federal government's, or school districts'; not a housing authority's or an industrial development agency's. As in New Jersey, a site's operator is `unknown` and it has no official page (REC-9): owning a lot doesn't say who may park there.
- A lot NJ Transit or the Thruway lists on a town's parking parcel is that site, within 90 m (ING-14).
- Admitted: the Thruway's under the OPEN-NY terms; the parcels as terms unstated (ADR-0014).

## Consequences

- New York State has 30 confirmed commuter lots and about 650 unconfirmed sites in 171 towns, most in Buffalo, Islip, and Syracuse.
- The 24 counties that don't share their parcels, among them Nassau, Monroe (Rochester), Dutchess, Saratoga, Schenectady, and Niagara, have no sites until their own data or pages are checked.
- NYSDOT's park-and-rides wait for NYSDOT's own copy, or its permission.
- Cities' own lot pages are next, largest first, as for New Jersey's towns.
