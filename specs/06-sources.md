# 06 Sources

Every source below was opened through its API or page on 2026-11-03, and the counts are from live queries that day. A source is ingested only when its status is **Admitted** (ADR-0005, ING-6). Admission needs, all checked against the live source: the dataset ID or URL, format, fields and coordinates, update frequency, terms, and rate limits, with no open terms question.

Statuses: **Admitted** (the worker ingests it), **Verified** (checked and usable, with an adapter planned), **Blocked** (waiting on an open question), **Later** (useful for a later slice), **Rejected** (not usable).

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
| `njt-parking-lots` | Parking Lot Database View (behind the [NJ Transit Parking Viewer](https://experience.arcgis.com/experience/ff3d812b33bf4bd9b90991a38155fc09)) | NJ Transit, published from a staff account | ArcGIS item [2f311895a644453f8f679479187aa19e](https://www.arcgis.com/home/item.html?id=2f311895a644453f8f679479187aa19e), layer 24 of `ParkingLotDB_20260320_Sync_view`, polygons with lat/long | `name`, `station`, `municipality`, `lotowner`, `totalspaces`, `adaspaces`, the fee fields, the restriction fields, `active`, `dateupdated` | Layer edited 2026-10-08. Every lot's `dateupdated` is 2025-05-30 | None stated | **Blocked (SRC-2, PRD-4).** 511 lots: 189 municipal, 168 NJ Transit, 28 shared, 32 private, 72 with no owner. Fee text is free text and sometimes cut off with "…". Resolve the layer URL from the item ID, because the layer name contains a date. |
| `njdot-park-ride` | New_Jersey_DOT_Park_Ride | NJDOT | ArcGIS item [ab33be6e4a51439c9ed179809b4d99cf](https://www.arcgis.com/home/item.html?id=ab33be6e4a51439c9ed179809b4d99cf), points | `pr_Name`, `Municipality`, `County`, coordinates (other fields mostly empty) | Data last edited 2024-02-28 | Liability disclaimer only | **Blocked (SRC-3).** 17 lots. The NJGIN hub only re-lists this layer. |
| — | NJ Transit Owned Lots_View | NJ Transit GIS | Item 17230d392de84a2d8cf635f27dab8058 | Tax-parcel fields | 2026-10-20 | Asks for credit | **Rejected.** 2,521 tax parcels, not parking. |
| — | State Park Service Points of Interest, `FEATURE_TYPE` = Parking | NJDEP | Item ac19884cc71741ff91b808da50219ec2, `mapsdep.nj.gov/…/Features/Land/MapServer/62` | Name, source date | Point dates 2012–2018 | Data Distribution Agreement: set credit line, metadata must go with the data | **Later (SRC-4, PRD-3).** 1,041 parking points. |
| — | Municipal Parking Lots | City of Jersey City | [municipal-parking-lots](https://data.jerseycitynj.gov/explore/dataset/municipal-parking-lots/), OpenDataSoft | `lots`, `address`, `geopoints` | Once, 2020-11-25 | Portal terms | **Rejected for now (SRC-5).** 7 lots, with no hours or rates. Its "2 hours free" note was a 2020 holiday promotion. |
| — | Jersey City Parking Authority | JCPA | None found | — | — | — | **Blocked (SRC-5).** Only third-party listings, which we can't use. |
| — | Port Authority facilities | PANYNJ | None found | — | — | — | **Rejected.** There's no parking-facility endpoint. |

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
