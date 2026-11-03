# Open questions

Unknowns, by ID. Code and specs refer to these IDs instead of guessing. Legal, licensing, and terms text is never invented; it stays a marked placeholder until its question is answered.

Prefixes: SRC (a data source's terms or availability), PRD (product), LEG (legal), HOST (hosting), VEN (vendor).

## Data sources

| ID | Question | Blocks | Status |
|---|---|---|---|
| SRC-1 | Can we republish the hours and rates on the nyc.gov DOT page (nyc.gov/html/dot/html/motorist/parkinglist.shtml), given that the nyc.gov Terms of Use say site content is "All rights are reserved"? Options: link out only; ask DOT or the Office of Technology and Innovation to publish the data on NYC Open Data; get a lawyer's view. | Rates in slice 3 | Open |
| SRC-2 | NJ Transit's Parking Lot Database (ArcGIS item 2f311895a644453f8f679479187aa19e) states no license or terms. Ask the NJ Transit GIS Department for terms, and for a stable URL (the layer's name contains a date). | Slice 2 | Open |
| SRC-3 | NJDOT's park-and-ride layer (item ab33be6e4a51439c9ed179809b4d99cf) has only a liability disclaimer. Does NJDOT allow redistribution in a public app? | Slice 2 | Open |
| SRC-4 | NJDEP's Data Distribution Agreement requires a set credit line and says the data "may not be reproduced or redistributed without all the metadata". Does an app that shows points (and links to the metadata) meet that? | NJ state park parking, slice 4 | Open |
| SRC-5 | Jersey City: is there a current list of municipal lots, from the city or the Jersey City Parking Authority, and under what terms? The portal's only dataset has 7 lots from 2020. | Slice 4 | Open |
| SRC-6 | Which map tile provider, and do its terms allow a public app at our expected traffic? OpenStreetMap's own tile servers aren't meant for this. | The map in slice 1 (the list works without it) | Open |

## Product

| ID | Question | Status |
|---|---|---|
| PRD-1 | What does "city-run" include? | **Decided 2026-11-03 by the user:** any public agency, labeled by operator (ADR-0007). |
| PRD-2 | The wording of the accuracy disclaimer. It needs a lawyer; the app shows a marked placeholder until then. | Open, blocks public launch |
| PRD-3 | Coverage area: NYC plus NJ only, or all of New York State as well (adding the Thruway lots)? | Open, blocks slice 4 |
| PRD-4 | NJ Transit lots with no recorded owner (72 of 511): show them as transit-agency lots, or leave them out until the owner is known? | Open, blocks slice 2 |
| PRD-5 | Search radius: what default and maximum? The draft in specs/05-api.md uses a 2 km default and a 10 km maximum. | Open, for slice 1 review |

## Legal

| ID | Question | Status |
|---|---|---|
| LEG-1 | The app's own terms of use and privacy notice. These are written by a lawyer, not by us. The privacy notice should describe ADR-0006. | Open, blocks public launch |

## Hosting and vendors

| ID | Question | Status |
|---|---|---|
| HOST-1 | Where to host the API, the worker, and PostGIS. The host's load balancer and CDN logs have to drop query strings (ADR-0006). | Open, blocks deployment |
| VEN-1 | A geocoder for address search ("parking near this address"), and its terms on caching and display. Slice 1 uses the device's location or a tap on the map instead. | Open, later slice |
