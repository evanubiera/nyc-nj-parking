# 06 Sources

Every source below was opened through its API or page on 2026-11-03, and the counts are from live queries that day. A source is ingested only when its status is **Admitted** (ADR-0005, ING-6). Admission needs, all checked against the live source: the dataset ID or URL, format, fields and coordinates, update frequency, terms, and rate limits, with no open terms question. A source whose terms are unstated (no license, or only a liability disclaimer) can be **Admitted, terms pending** while we ask its publisher (ADR-0011), and comes out if the publisher objects.

Statuses: **Admitted** (the worker ingests it), **Admitted, terms pending** (ingested under ADR-0011 while we ask), **Verified** (checked and usable, with an adapter planned), **Blocked** (waiting on an open question), **Later** (useful for a later slice), **Rejected** (not usable).

The `Admitted` table is read by a test (ING-6). Keep its format: one source ID per row, in backticks.

## Admitted

| Source ID | Dataset | Admitted in |
|---|---|---|
| `nyc-facdb-dot` | Facilities Database, rows with `datasource = 'dot_publicparking'` | S1-3, 2026-11-03 |
| `nyc-meters-offstreet` | Parking Meters Locations and Status, rows with `facility = 'Off Street'` | S1-4, 2026-11-03 |

## Terms that apply

- **NYC Open Data** (data.cityofnewyork.us): NYC Admin Code [§ 23-502(d)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577) says public datasets are available "without any restrictions on their use". The City may require an app to identify the source and version and describe any changes made. We do that for every source anyway (ADR-0008).
- **nyc.gov pages**: the [nyc.gov Terms of Use](https://www.nyc.gov/main/terms-of-use) say site content is the City's property and "All rights are reserved" (SRC-1).
- **NY State Open Data** (data.ny.gov): [OPEN-NY Terms of Use](https://data.ny.gov/dataset/OPEN-NY-Terms-Of-Use/77gx-ii52), last modified 2013-03-08. Any lawful use is allowed, with no attribution requirement. The State can tell us in writing to stop using or displaying content. The State seal and site graphics can't be used.
- **Jersey City Open Data**: the portal's [terms and conditions](https://data.jerseycitynj.gov/terms/terms-and-conditions/) grant reuse of public datasets unless a dataset states other terms.
- **ArcGIS layers (NJ)**: terms are set per layer, in the item's "terms of use" field. They're listed per source below.
- **Socrata rate limits** ([app tokens](https://dev.socrata.com/docs/app-tokens.html)): without a token, requests share a pool by IP address and may be throttled. With a token, Socrata currently doesn't throttle unless use is abusive. The worker sends `SOCRATA_APP_TOKEN` (ING-5).
- **ArcGIS rate limits**: none are stated for these hosted layers. Queries return at most 1,000 to 2,000 records per page (`maxRecordCount`), so adapters page through results.

## New York City

| Source ID | Dataset | Publisher | Endpoint and format | Fields we use | Updates | Status |
|---|---|---|---|---|---|---|
| `nyc-facdb-dot` | Facilities Database, rows with `datasource = 'dot_publicparking'` | DCP, from a DOT feed | [ji82-xba5](https://data.cityofnewyork.us/d/ji82-xba5), SODA JSON | `uid`, `facname`, `address`, `boro`, `latitude`, `longitude`, `opname` | Every 6 months (last 2026-07-16) | **Admitted.** 35 DOT garages and fields. `capacity` is 0 on every row. It's missing at least Hunts Point, Bronxdale, Meeker Avenue, West Brighton Avenue, and Borough Hall. |
| `nyc-meters-offstreet` | Parking Meters Locations and Status, rows with `facility = 'Off Street'` | DOT | [693u-uax6](https://data.cityofnewyork.us/d/693u-uax6), SODA JSON, one point per meter | `parking_facility_name`, `meter_hours` (such as "15HR Pas Mon-Sat 0700-2200"), `status`, `lat`, `long` | Weekly, automated (last 2026-11-02) | **Admitted.** About 33 metered fields, including Meeker Avenue and West Brighton Avenue. `status` values are inconsistent ("Active", "active", blank). `meter_hours` gives the metered period, time limit, and vehicle class ("Pas" or "Com"), not opening hours. Off-street values on 2026-11-03 used 16 forms, plus one unusable value ("Rate NOT Available …"). The attended garages have no meters, so no hours. The dataset has no operator column; the adapter records these fields as DOT's, since they're DOT meters in DOT municipal fields. |
| — | DOT Municipal Parking Facilities page | DOT | [nyc.gov page](https://www.nyc.gov/html/dot/html/motorist/parkinglist.shtml), HTML, no coordinates | Address, spaces, hours, rates, permits, notices, for about 40 facilities | No stated cadence. Garage rates are "effective October 1, 2024" | **Blocked (SRC-1).** Until then, it's the `officialUrl` we link to. |
| — | Municipal Parking Facilities (five borough entries) | DOT | [i8d5-5ciu](https://data.cityofnewyork.us/d/i8d5-5ciu) and four others: links only, no columns | — | 2011 | **Rejected.** Links to the page above. |
| — | Parks Parking Lots (DPR_ParkingLots_001) | DPR | [6njb-jmjq](https://data.cityofnewyork.us/d/6njb-jmjq), multipolygons | `gispropnum`, `borough` | Last 2017-07-12 | **Rejected for now.** About 540 polygons with no names, hours, or flag for public use. |
| — | Carshare Locations, Municipal Garages and Lots | DOT | [j4y5-w7iq](https://data.cityofnewyork.us/d/j4y5-w7iq) | `name`, `site_addres` | Annually | **Rejected.** 9 facilities. A cross-check at most. |
| — | ParkNYC Block Faces | DOT | [e7yp-wx55](https://data.cityofnewyork.us/d/e7yp-wx55), multilines | `meter_rate`, street segment | Monthly | **Later** (on-street parking) |
| — | Parking Regulation Locations and Signs | DOT | [nfid-uabd](https://data.cityofnewyork.us/d/nfid-uabd) | `sign_description`, `sign_x_coord`, `sign_y_coord` | Daily | **Later** (on-street parking) |

## New York State

| Dataset | Publisher | Endpoint | Updates | Status |
|---|---|---|---|---|
| MTA Rail Stations | MTA | [wxmd-5cpm](https://data.ny.gov/d/wxmd-5cpm) | Daily | **Rejected.** Station points only; 113 of 126 LIRR stations link to a PDF parking map, and no Metro-North stations do. |
| Thruway Commuter Park and Ride Lots | NYS Thruway Authority | [nvxe-b625](https://data.ny.gov/d/nvxe-b625): `title`, `run_by`, `spaces`, lat/lng | As needed (last 2024-12-12) | **Later, if PRD-3 includes NY State.** 31 lots, all in Rockland County or farther north. |
| State Park Facility Points | NYS OPRHP | [9uuk-x7vh](https://data.ny.gov/d/9uuk-x7vh) | As needed | **Rejected.** No parking attribute. |
| Public Parking Counts at Port Authority Airports | PANYNJ | [h87k-kqb6](https://data.ny.gov/d/h87k-kqb6) | Last 2016-10-31 | **Rejected.** Monthly counts per airport, with no locations. |

## New Jersey

| Source ID | Dataset | Publisher | Endpoint | Fields | Updates | Terms | Status |
|---|---|---|---|---|---|---|---|
| `njt-parking-lots` | Parking Lot Database View (behind the [NJ Transit Parking Viewer](https://experience.arcgis.com/experience/ff3d812b33bf4bd9b90991a38155fc09)) | NJ Transit, published from a staff account | ArcGIS item [2f311895a644453f8f679479187aa19e](https://www.arcgis.com/home/item.html?id=2f311895a644453f8f679479187aa19e), layer 24 of `ParkingLotDB_20260320_Sync_view`, polygons with lat/long | `name`, `station`, `municipality`, `lotowner`, `totalspaces`, `adaspaces`, the fee fields, the restriction fields, `active`, `dateupdated` | Layer edited 2026-10-08. Every lot's `dateupdated` is 2025-05-30 | None stated | **Verified; can be Admitted, terms pending (ADR-0011) once its adapter exists. Terms asked (SRC-2); PRD-4 still to decide.** 511 lots: 189 municipal, 168 NJ Transit, 28 shared, 32 private, 72 with no owner. Fee text is free text and sometimes cut off with "…". Resolve the layer URL from the item ID, because the layer name contains a date. |
| `njdot-park-ride` | New_Jersey_DOT_Park_Ride | NJDOT | ArcGIS item [ab33be6e4a51439c9ed179809b4d99cf](https://www.arcgis.com/home/item.html?id=ab33be6e4a51439c9ed179809b4d99cf), points | `pr_Name`, `Municipality`, `County`, coordinates (other fields mostly empty) | Data last edited 2024-02-28 | Liability disclaimer only | **Verified; can be Admitted, terms pending (ADR-0011) once its adapter exists. Terms asked (SRC-3).** 17 lots. The NJGIN hub only re-lists this layer. |
| — | NJ Transit Owned Lots_View | NJ Transit GIS | Item 17230d392de84a2d8cf635f27dab8058 | Tax-parcel fields | 2026-10-20 | Asks for credit | **Rejected.** 2,521 tax parcels, not parking. |
| — | State Park Service Points of Interest, `FEATURE_TYPE` = Parking (the layer is now titled "Open Space (State Owned) Points of Interest") | NJDEP | Item ac19884cc71741ff91b808da50219ec2, `mapsdep.nj.gov/…/Features/Land/MapServer/62` | Name, source date | Point dates 2012–2018 | Data Distribution Agreement: set credit line, metadata must go with the data | **Later (SRC-4, PRD-3).** 1,041 parking points. On 2026-11-03, none of the other 20 services under `mapsdep.nj.gov/arcgis/rest/services/Features` had a parking layer. |
| — | Sustainable Business Registry | NJDEP | `mapsdep.nj.gov/arcgis/rest/services/Features/Structures/MapServer/7` | `ORG_NAME`, `ORG_TYPE`, address, lat/long | — | NJDEP's | **Rejected.** A list of registered businesses, not parking. It was suggested as NJDOT park-and-ride data, but it's on NJDEP's server, and the Structures service has no parking layer. |
| — | NJ Transit Developer Portal: BUSDATA, RailData, GTFS-BUS, GTFS-RAIL | NJ Transit | [developer.njtransit.com](https://developer.njtransit.com/), HTTP POST with a token | Bus and rail real-time data and schedules | — | Needs an account, an administrator's approval, and accepting a data-feed agreement whose text isn't shown without an account. Limit of about 40,000 requests a day | **Rejected.** None of its four APIs has parking data, and its sign-up and agreement don't meet ADR-0011's conditions. Checked 2026-11-03. |
| — | Municipal Parking Lots | City of Jersey City | [municipal-parking-lots](https://data.jerseycitynj.gov/explore/dataset/municipal-parking-lots/), OpenDataSoft | `lots`, `address`, `zip_code`, `geopoints` | Once, 2020-11-25 (rechecked 2026-11-03: still 7 records, unchanged) | Portal terms | **Rejected for now (SRC-5).** 7 lots, with no hours or rates. Its "2 hours free" note was a 2020 holiday promotion. |
| — | Jersey City Parking Authority | JCPA | None found | — | — | — | **Blocked (SRC-5).** Only third-party listings, which we can't use. |
| — | Port Authority facilities | PANYNJ | None found | — | — | — | **Rejected.** There's no parking-facility endpoint. |

## New Jersey municipalities (researched 2026-11-03)

Searched: ArcGIS Online for layers titled "parking" in 34 of NJ's largest cities and best-known parking towns; Socrata (none of the 83 portals with a parking dataset is in NJ); and each city's parking authority or utility. **No NJ city publishes its municipal lots as open data**, apart from Jersey City's 7 lots from 2020 (above) and Hoboken's small layer. Elsewhere, lot lists are on city or authority websites only.

Many of these authorities' lots at train stations are already in NJ Transit's Parking Lot Database: it lists 189 lots owned by municipalities.

**Opened and checked:**

| City | What exists | Format and terms | Status |
|---|---|---|---|
| Hoboken | [Municipal Garages and Lots](https://www.hobokennj.gov/resources/municipal-garages) page: Garage B (28 2nd Street, 829 spaces), Garage D (215 Hudson Street, 488), Garage G (315 Hudson Street, 488), Midtown (371 4th Street, 730), Lot 3 (1301 Jefferson Street) and Lot 4 (1500 Park Avenue, permit lots), hours, contacts, and an availability table | An HTML page with no coordinates. The availability table is embedded from a third-party table service (not opened). No terms stated on the page | **Candidate (SRC-7).** Could be Admitted, terms pending (ADR-0011) once Hoboken is asked. It would be a small, hand-checked list, geocoded once. |
| Hoboken | ArcGIS layer "Hoboken Municipal Parking Facilities" (item 984428ec74e9444da7f2f55b250a4f9b), owned by the City of Hoboken's organization | 3 points (Midtown, B, D), names only, from 2021, no terms | **Rejected.** The page above is more complete. |
| Paterson | [Parking Authority](https://www.patersonnj.gov/department/?fDD=7-0) page: the authority runs 13 off-street facilities with 3,068 spaces | No list of facilities. The site footer reads "© 2026 City of Paterson" | **Blocked (SRC-8).** No list to use. Its station lots may be in NJ Transit's database. |
| Camden | Camden County GIS layer "Parking Authority Camden City Parcels" (item 566c410a21fb4cee9136dce890db8632), 2025 | 20 tax parcels owned by the parking authority, not parking facilities | **Rejected.** |
| "Newark" | ArcGIS "Public Parking Public" (item 1fc6bc53ca584761bcc2ab0b7243af5d) | Its 2 lots are at 43.05, −77.09, in Newark, New York | **Rejected** (not NJ). |
| "Plainfield" | ArcGIS "Municipal Parking Zones MPZ" (item 0186cc5909d04fb1a6b1e6a573cb7da6) | Its zones are at 39.70, −86.40, in Plainfield, Indiana | **Rejected** (not NJ). |

**From web searches only, not opened** (to be checked the same way before use):

| City | What the search found |
|---|---|
| Newark | No official list of the Newark Parking Authority's lots found; only third-party listings. |
| New Brunswick | The New Brunswick Parking Authority (njnbpa.org) has a parking locator and, per a 2024 news report, nine decks. |
| Morristown | The Morristown Parking Authority (mpanj.org) runs three garages, several surface lots, and about 700 meters. |
| Montclair | The township's Parking Utility pages name its decks (Bay Street, Crescent, North Fullerton, Midtown) and surface lots. |
| Princeton | princetonnj.gov/parking covers the Spring Street Garage and municipal lots; rates changed under Ordinance 2026-29. |
| Elizabeth | No official site for the Parking Authority of the City of Elizabeth found; third-party listings name Lots 1, 5, and 6. |
| Trenton | No official site for the Trenton Parking Authority found. |
| Camden | No official site for the Parking Authority of the City of Camden found. |
| Atlantic City | No list of the Atlantic City Parking Authority's lots found. |
| Asbury Park | cityofasburypark.com/parking covers the Bangs Avenue garage and city lots. |
| Red Bank | The borough's site describes its municipal lots and permit rules. |
| Hackensack | The city code covers its municipal lots and garages; no map or list found. |

Third-party sites such as Parkopedia, ParkMobile, Parksy, and Neighbor list many of these lots, but they're commercial aggregators, not publishers, and aren't sources we use.

## Claims from the original notes that didn't hold up

1. There's no real-time availability feed for DOT garages.
2. There's no Port Authority endpoint for parking facilities.
3. There's no MTA, LIRR, Metro-North, or Staten Island Railway lot dataset on data.ny.gov.
4. The NY State Parks dataset has no parking.
5. The NYC Parks lot data is from 2017, with no names, hours, or public-use flag.
6. NJGIN only re-lists NJDOT's 17 lots.
7. NJ Transit lot data exists only as an ArcGIS layer with no stated terms. The "Owned Lots" layer is tax parcels.
8. The example record's "2 hours free" was a 2020 holiday promotion.
9. NYC has two structured off-street sources plus one HTML page, not four to six datasets. Four to six holds only once on-street parking is counted.
10. NJ is fragmented across hundreds of municipalities, but NJ Transit's database already covers 189 municipally owned commuter lots.

From notes checked on 2026-11-03:

11. `mapsdep.nj.gov/…/Features/Structures/MapServer/7` isn't NJDOT park-and-ride data. It's NJDEP's Sustainable Business Registry.
12. Jersey City's municipal-parking-lots dataset has 7 records, not 12.
13. NJ Transit's developer API has no parking data. It covers bus and rail real-time data and schedules.
