# Open questions

Unknowns, by ID. Code and specs refer to these IDs instead of guessing. Legal, licensing, and terms text is never invented; it stays a marked placeholder until its question is answered.

Prefixes: SRC (a data source's terms or availability), PRD (product), LEG (legal), HOST (hosting), VEN (vendor).

## Data sources

| ID | Question | Blocks | Status |
|---|---|---|---|
| SRC-1 | Can we republish the hours and rates on the nyc.gov DOT page (nyc.gov/html/dot/html/motorist/parkinglist.shtml), given that the nyc.gov Terms of Use say site content is "All rights are reserved"? Options: link out only; ask DOT or the Office of Technology and Innovation to publish the data on NYC Open Data; get a lawyer's view. | Rates in slice 3 | Open |
| SRC-2 | NJ Transit's Parking Lot Database (ArcGIS item 2f311895a644453f8f679479187aa19e) states no license or terms. Ask the NJ Transit GIS Department for terms, and for a stable URL (the layer's name contains a date). | — | Not required before going live: the user decided on 2026-11-10 to turn the source on without asking first (ADR-0014). Live since 2026-11-10. The request drafted on 2026-11-03 is optional; the source comes out if the publisher objects. |
| SRC-3 | NJDOT's park-and-ride layer (item ab33be6e4a51439c9ed179809b4d99cf) has only a liability disclaimer. Does NJDOT allow redistribution in a public app? | — | Not required before going live: the user decided on 2026-11-10 to turn the source on without asking first (ADR-0014). Live since 2026-11-10. The request drafted on 2026-11-03 is optional; the source comes out if the publisher objects. |
| SRC-4 | NJDEP's Data Distribution Agreement requires a set credit line and says the data "may not be reproduced or redistributed without all the metadata". Does an app that shows points (and links to the metadata) meet that? | NJ state park parking, slice 4 | Open |
| SRC-5 | Jersey City: is there a current list of municipal lots, from the city's Parking Division, and under what terms? The portal's only dataset has 7 lots from 2020. | Slice 4 | Open. Request drafted 2026-11-04, not yet sent ([docs/requests/jersey-city-parking-division.md](requests/jersey-city-parking-division.md)), with 73 candidate sites from the State's parcel layer. The city's site now lists a Parking Division, under Public Safety, rather than a separate Parking Authority. 2026-11-04: the user reports the city told them it doesn't object to the app showing its parking information. Meanwhile the city's 7 lots and its unconfirmed sites from tax records are shown (ADR-0012): 21 since 2026-11-06 (ADR-0015). |
| SRC-6 | Which map tile provider, and do its terms allow a public app at our expected traffic? | — | **Decided 2026-11-03 by the user (ADR-0009):** self-hosted Protomaps PMTiles in production; OpenFreeMap's public instance for development and previews until then. |
| SRC-7 | Hoboken: may we list the Parking Utility's garages and lots from hobokennj.gov (names, addresses, capacities, hours) and link to it, and is its garage availability table meant to be reused? The page states no terms. | — | Not required before going live (ADR-0014). Hoboken's 3 garages that take hourly parkers are live since 2026-11-06 (ADR-0015). Not asked; asking could also bring the garages' hours and regular rates, which the page doesn't give. |
| SRC-8 | Other NJ parking authorities (Newark, Paterson, New Brunswick, Morristown, Montclair, Princeton, Elizabeth, Trenton, Camden, Atlantic City, Asbury Park, Red Bank, Hackensack) publish lots only on their websites, or not at all. For each: ask for a list and its terms, or rely on NJ Transit's database for their station lots. | Slice 4 | Open |
| SRC-9 | OpenStreetMap is under the Open Database License, whose share-alike condition covers results that alter or build on its data. If we merged its names or hours into our facility data, what would we have to share, and how? Needs a lawyer's view (LEG-1). | Using OpenStreetMap data, later | Open (2026-11-06) |
| SRC-10 | West New York: may we show the Parking Utility's municipal lots, spaces, meter hours, rates, and overnight pass from its Facilities page in the app, with credit and a link? The page states no terms. | — | Not required before going live: the user decided on 2026-11-06 not to ask first (ADR-0014). Live since 2026-11-06. A request with useful questions (time limits, the Dewey Triangle lot) is drafted and optional ([docs/requests/west-new-york-parking-utility.md](requests/west-new-york-parking-utility.md)). |
| SRC-11 | Weehawken: which municipal lots does the Parking Authority of the Township of Weehawken run today, where exactly, with what hours, rates, and time limits, and is there a page or list we could use and link to? The Township's website has nothing on parking, and the code on eCode360 can't be republished (specs/06). | Weehawken's lots, slice 4 | Open (2026-11-07). Request drafted, not sent ([docs/requests/weehawken-parking-authority.md](requests/weehawken-parking-authority.md)). Meanwhile Weehawken shows one unconfirmed site from tax records. |
| SRC-12 | Bayonne: the meter hours, spaces, and lot numbers of the Parking Utility's lots, which the City's own pages don't give; and where the three ordinance lots left out are today (block 221 between East 19th and 21st Streets, the East 26th Street south lot, and West 9th Street), and where Lots 12 (Broadway at 29th Street), 13 (behind the library), and 14 (West 8th Street) are. | Hours, rates, and spaces for Bayonne's lots | Open (2026-11-07). Not asked. The 9 lots are live without it (ADR-0016). |
| SRC-13 | Secaucus: may we show the Northend and Centre Avenue Municipal Lots, named on the Town's Parking & ParkMobile page? The Town's terms of use forbid reproducing or posting its site's content without its consent (specs/06). | Secaucus's lots | Open (2026-11-07). Not asked. |
| SRC-14 | Lots a town says are for permit holders, renters, or reserved parking only are still shown as unconfirmed sites where the tax records describe them as parking: North Bergen's rental lots (such as 1314 14th St and 600 Liberty Ave), Guttenberg's reserved 71st Street lot, East Newark's fee lots. Should a town's own word that a lot isn't for visitors hide its site, and which pages may we use for that, given North Bergen's terms? | — | Decided 2026-11-07 (ADR-0017): yes, a site its own town names, or plainly covers, as not for visitors is left out; the town's page is used only to leave it out, so its terms don't stand in the way. Five sites so far (specs/06). |
| SRC-15 | Montclair and Maplewood: the Townships' sites refuse the worker's requests (403), so Montclair's Parking Utility lot list and Maplewood's parking pages can't be read automatically. Is there a feed, file, or page we may fetch, and may we show their lots? | Montclair's and Maplewood's lots | Open (2026-11-07). Not asked. |
| SRC-16 | Tenafly: is the Borough's Downtown Parking Map (a PDF made in 2015) current, and on which days and hours does the 3-hour limit in its nine free Park & Shop lots apply? The lots are only drawn on the map, without addresses (specs/06). | Tenafly's lots | Open (2026-11-07). Not asked. Tenafly shows 4 unconfirmed sites meanwhile. |

## Product

| ID | Question | Status |
|---|---|---|
| PRD-1 | What does "city-run" include? | **Decided 2026-11-03 by the user:** any public agency, labeled by operator (ADR-0007). |
| PRD-2 | The wording of the accuracy disclaimer. It needs a lawyer; the app shows a marked placeholder until then. | Open, blocks public launch |
| PRD-3 | Coverage area: NYC plus NJ only, or all of New York State as well (adding the Thruway lots)? | Open, blocks slice 4 |
| PRD-4 | NJ Transit lots with no recorded owner (72 of 511): show them as transit-agency lots, or leave them out until the owner is known? | **Decided 2026-11-03 by the user:** leave them out (ING-11). 54 of them have 0 spaces (stations such as New York Penn and Newark Airport), and some of the rest look like shopping-centre lots. Lots shared by NJ Transit and a town go under NJ Transit, and lots recorded as part private are left out. |
| PRD-5 | Search radius: what default and maximum? | **Decided 2026-11-03 by the user:** 2 km default, 100 m to 10 km (REC-2). |
| PRD-6 | Is the app commercial (advertising, fees, sponsorship, or run by a business)? Several vendors' free plans exclude commercial use, and some data terms may treat it differently. The chosen map options allow either (ADR-0009). | Open, not blocking yet |

## Legal

| ID | Question | Status |
|---|---|---|
| LEG-1 | The app's own terms of use and privacy notice. These are written by a lawyer, not by us. The privacy notice should describe ADR-0006. | Open, blocks public launch |

## Hosting and vendors

| ID | Question | Status |
|---|---|---|
| HOST-1 | Where to host the API, the worker, PostGIS, and the map's PMTiles file (served with HTTP range requests, ADR-0009). The host's load balancer and CDN logs have to drop query strings (ADR-0006) and tile paths (ADR-0009). | Open, blocks deployment |
| VEN-1 | A geocoder for address search ("parking near this address"), and its terms on caching and display. Slice 1 uses the device's location or a tap on the map instead. | **Decided 2026-11-06 by the user (ADR-0013):** NYC GeoSearch and the State's NJ_Geocode for addresses, called from the browser, and a built-in list of towns and neighbourhoods. |
