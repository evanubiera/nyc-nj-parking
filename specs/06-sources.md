# 06 Sources

Every source below was opened through its API or page on 2026-11-03, and the counts are from live queries that day. A source is ingested only when its status is **Admitted** (ADR-0005, ING-6). Admission needs, all checked against the live source: the dataset ID or URL, format, fields and coordinates, update frequency, terms, and rate limits, with no open terms question. A source whose terms are unstated (no license, or only a liability disclaimer) can be **Admitted, terms pending** while we ask its publisher (ADR-0011), or, since ADR-0014, **Admitted, terms unstated** without asking first; either comes out if the publisher objects.

Statuses: **Admitted** (the worker ingests it), **Admitted, terms pending** (ingested under ADR-0011 while we ask), **Admitted, terms unstated** (ingested under ADR-0014 without asking), **Verified** (checked and usable, with an adapter planned), **Blocked** (waiting on an open question), **Later** (useful for a later slice), **Rejected** (not usable).

The `Admitted` table is read by a test (ING-6). Keep its format: one source ID per row, in backticks.

## Admitted

| Source ID | Dataset | Admitted in |
|---|---|---|
| `nyc-facdb-dot` | Facilities Database, rows with `datasource = 'dot_publicparking'` | S1-3, 2026-11-03 |
| `nyc-meters-offstreet` | Parking Meters Locations and Status, rows with `facility = 'Off Street'` | S1-4, 2026-11-03 |
| `jc-municipal-lots` | Jersey City Municipal Parking Lots (7 lots, 2020) | S4-2, 2026-11-04 (ADR-0012) |
| `nj-parcels-jc-parking` | Parcels and MOD-IV Composite of NJ, Jersey City candidate sites only, shown as unconfirmed | S4-3, 2026-11-04 (ADR-0012) |
| `wny-parking-lots` | West New York Parking Utility's Facilities page, 9 metered lots, terms unstated | S4-12, 2026-11-06 (ADR-0014) |

## Terms that apply

- **NYC Open Data** (data.cityofnewyork.us): NYC Admin Code [§ 23-502(d)](https://codelibrary.amlegal.com/codes/newyorkcity/latest/NYCadmin/0-0-0-204577) says public datasets are available "without any restrictions on their use". The City may require an app to identify the source and version and describe any changes made. We do that for every source anyway (ADR-0008).
- **nyc.gov pages**: the [nyc.gov Terms of Use](https://www.nyc.gov/main/terms-of-use) say site content is the City's property and "All rights are reserved" (SRC-1).
- **NY State Open Data** (data.ny.gov): [OPEN-NY Terms of Use](https://data.ny.gov/dataset/OPEN-NY-Terms-Of-Use/77gx-ii52), last modified 2013-03-08. Any lawful use is allowed, with no attribution requirement. The State can tell us in writing to stop using or displaying content. The State seal and site graphics can't be used.
- **Jersey City Open Data**: the portal's [terms and conditions](https://data.jerseycitynj.gov/terms/terms-and-conditions/) grant reuse of public datasets unless a dataset states other terms.
- **ArcGIS layers (NJ)**: terms are set per layer, in the item's "terms of use" field. They're listed per source below.
- **Socrata rate limits** ([app tokens](https://dev.socrata.com/docs/app-tokens.html)): without a token, requests share a pool by IP address and may be throttled. With a token, Socrata currently doesn't throttle unless use is abusive. The worker sends `SOCRATA_APP_TOKEN` (ING-5).
- **ArcGIS rate limits**: none are stated for these hosted layers. A query returns at most `maxRecordCount` records (1,000 for NJ Transit's layer, which has 511). Each NJ adapter makes one query and fails with `upstream.too_large` if the response says it was cut short (`exceededTransferLimit`), the same as the Socrata row limit.

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
| `njt-parking-lots` | Parking Lot Database View (behind the [NJ Transit Parking Viewer](https://experience.arcgis.com/experience/ff3d812b33bf4bd9b90991a38155fc09)) | NJ Transit, published from a staff account | ArcGIS item [2f311895a644453f8f679479187aa19e](https://www.arcgis.com/home/item.html?id=2f311895a644453f8f679479187aa19e), layer 24 of `ParkingLotDB_20260320_Sync_view`, polygons with lat/long | `name`, `station`, `municipality`, `lotowner`, `totalspaces`, `adaspaces`, the fee fields, the restriction fields, `active`, `dateupdated` | Layer edited 2026-10-08. Every lot's `dateupdated` is 2025-05-30 | None stated | **Verified, adapter built (S2-4). Becomes Admitted, terms pending (ADR-0011) once the SRC-2 request is sent (S2-10). PRD-4 decided: lots with no owner are left out.** 511 lots: 189 municipal, 168 NJ Transit, 28 shared, 32 private, 72 with no owner. Fee text is free text and sometimes cut off with "…". Resolve the layer URL from the item ID, because the layer name contains a date. |
| `njdot-park-ride` | New_Jersey_DOT_Park_Ride | NJDOT | ArcGIS item [ab33be6e4a51439c9ed179809b4d99cf](https://www.arcgis.com/home/item.html?id=ab33be6e4a51439c9ed179809b4d99cf), points | `pr_Name`, `Municipality`, `County`, coordinates (other fields mostly empty) | Data last edited 2024-02-28 | Liability disclaimer only | **Verified, adapter built (S2-5). Becomes Admitted, terms pending (ADR-0011) once the SRC-3 request is sent (S2-10).** 17 lots. The NJGIN hub only re-lists this layer. |
| — | NJ Transit Owned Lots_View | NJ Transit GIS | Item 17230d392de84a2d8cf635f27dab8058 | Tax-parcel fields | 2026-10-20 | Asks for credit | **Rejected.** 2,521 tax parcels, not parking. |
| — | State Park Service Points of Interest, `FEATURE_TYPE` = Parking (the layer is now titled "Open Space (State Owned) Points of Interest") | NJDEP | Item ac19884cc71741ff91b808da50219ec2, `mapsdep.nj.gov/…/Features/Land/MapServer/62` | Name, source date | Point dates 2012–2018 | Data Distribution Agreement: set credit line, metadata must go with the data | **Later (SRC-4, PRD-3).** 1,041 parking points. On 2026-11-03, none of the other 20 services under `mapsdep.nj.gov/arcgis/rest/services/Features` had a parking layer. |
| — | Sustainable Business Registry | NJDEP | `mapsdep.nj.gov/arcgis/rest/services/Features/Structures/MapServer/7` | `ORG_NAME`, `ORG_TYPE`, address, lat/long | — | NJDEP's | **Rejected.** A list of registered businesses, not parking. It was suggested as NJDOT park-and-ride data, but it's on NJDEP's server, and the Structures service has no parking layer. |
| — | NJ Transit Developer Portal: BUSDATA, RailData, GTFS-BUS, GTFS-RAIL | NJ Transit | [developer.njtransit.com](https://developer.njtransit.com/), HTTP POST with a token | Bus and rail real-time data and schedules | — | Needs an account, an administrator's approval, and accepting a data-feed agreement whose text isn't shown without an account. Limit of about 40,000 requests a day | **Rejected.** None of its four APIs has parking data, and its sign-up and agreement don't meet ADR-0011's conditions. Checked 2026-11-03. |
| — | Municipal Parking Lots | City of Jersey City | [municipal-parking-lots](https://data.jerseycitynj.gov/explore/dataset/municipal-parking-lots/), OpenDataSoft | `lots`, `address`, `zip_code`, `geopoints` | Once, 2020-11-25 (rechecked 2026-11-03: still 7 records, unchanged) | Portal terms | **Admitted (ADR-0012), as `jc-municipal-lots`.** 7 lots, with no hours or rates, shown with their 2020 date. The State's parcel layer still describes each as public parking (August 2026). Its "2 hours free" note was a 2020 holiday promotion and isn't used. |
| — | Jersey City Parking Division (formerly listed as the Jersey City Parking Authority) | City of Jersey City | None found. Its [page](https://jerseycity.hosted.civiclive.com/parking) has permits and enforcement, but no list of lots (checked 2026-11-04) | — | — | — | **Blocked (SRC-5).** Only third-party listings, which we can't use. Request drafted with 73 candidate sites (docs/requests). |
| — | Parcels and MOD-IV Composite of NJ (checked 2026-11-04) | NJOGIS, from county and municipal parcel maps and the Division of Taxation's MOD-IV tax list | ArcGIS item [533599bbfbaa4748bf39faf1375a8a9c](https://www.arcgis.com/home/item.html?id=533599bbfbaa4748bf39faf1375a8a9c), `Parcels_Composite_NJ_WM/FeatureServer/0`, polygons in Web Mercator (query with `outSR=4326`), 3,481,240 parcels, 2,000 per query | `PAMS_PIN` (municipality, block, lot), `PROP_CLASS`, `PROP_LOC`, `BLDG_DESC`, `LAND_DESC`, `FAC_NAME`, `PROP_USE`. `OWNER_NAME` is blank on every parcel: the State redacts it under Daniel's Law (P.L. 2020, c. 125) | Published 2026-08-24. No stated cadence | Liability disclaimer; not survey data; credit to NJOGIS requested. Also under the State's [Conditions of Use](https://www.nj.gov/nj/legal.shtml): Section F lets anyone view, copy, and distribute State information unless particular material says otherwise, and the State seal is restricted. The county records it points to weren't reviewed | **Admitted for Jersey City only (ADR-0012), as `nj-parcels-jc-parking`, for unconfirmed sites.** Elsewhere: later (slice 4), for finding candidates. NJOGIS's two Hudson County parcel items carry the same terms, with nothing county-specific (checked 2026-11-04). See "State parcels and tax records" below. |
| — | Port Authority facilities | PANYNJ | None found | — | — | — | **Rejected.** There's no parking-facility endpoint. |

## New Jersey adapters (slice 2)

Rules decided with the user on 2026-11-03 (PRD-4, ADR-0007), and counts from the live layers that day, which the saved fixtures reproduce. Neither source runs until S2-10 admits it.

### `njt-parking-lots` (S2-4)

- **Fetch:** the item (2f311895a644453f8f679479187aa19e) gives the service URL, the service gives its one layer (24 today), and the layer's `editingInfo.dataLastEditDate` is the data date (2026-10-08). Then one query: `where=1=1`, `returnGeometry=false`, `returnCentroid=true`, `outSR=4326`, and only the fields below. Contact names and phone numbers (`contacname`, `pubcontact`, `contaccomp`) aren't requested, so they're never stored.
- **Fields:** `facilityid`, `name`, `lot_number`, `lotuse`, `municipality`, `county`, `location`, `lotowner`, `totalspaces`, `active`, `conwebsite`, plus the centroid.
- **Record ID:** `{lotuse}/{facilityid}`, such as `rail/Trenton_01`. `facilityid` alone repeats twice (Trenton and Walter Rand each have a rail or bus lot and a light rail lot). Facility IDs are `njt-` plus the `facilityid` words, such as `njt-atlantic-city-01`.
- **Left out on purpose** (not errors): the row whose `lotuse` is `test`; lots whose `active` isn't "Active" (one "Inactive", one "No Parking for FIFA World Cup"); lots with 0 spaces, which are station entries with no parking (60); and lots with no `lotowner` (17 once the others are out; PRD-4).
- **Withheld** (ING-11): owners recorded as private, which are "Private", "Avalon Bay", "NJ Transit/Private", and "Municipal/Private" (32). They're stored, but never published, so an NJDOT record for the same lot stays hidden too.
- **Owner to operator** (ADR-0007):

  | `lotowner` | Operator name | Type | Lots |
  |---|---|---|---|
  | Municipality | `municipality`, as published (such as "Montclair Township") | `municipal` | 189 |
  | NJ Transit, NJ TRANSIT/Municipality, NJ Transit/Kean University | NJ Transit | `transit_agency` | 163, 28, 1 |
  | PATCO | PATCO | `transit_agency` | 5 |
  | NJTA, NJ Turnpike | New Jersey Turnpike Authority | `public_authority` | 5, 1 |
  | PANYNJ | Port Authority of New York and New Jersey | `public_authority` | 1 |
  | NJDOT | New Jersey Department of Transportation | `state` | 3 |
  | County | `county` plus "County" (such as "Somerset County") | `county` | 3 |

  An owner not in this table counts as a row that can't be read, so a change in the data trips ING-10 instead of guessing.
- **Location:** the centroid of the lot's outline. The `lat` and `long` fields are missing on 199 lots and wrong on some: Parsippany (Beverwyck) is placed 5,457 km away, and Pennsauken/Route 73 2.5 km.
- **Name:** `name` as published. **Lot number** (REC-8): `lot_number`, without leading zeros ("02" becomes "2"), only when the source lists more than one lot with the same `name` and `lotuse` (284 lots).
- **Kind:** `garage` when the name says "Garage" or "Deck" (Englewood, and the South Mountain Arena deck), otherwise `lot`.
- **Address and region:** the address line is `location`, which gives cross streets (such as "Station Ave & White Horse Pike"). The locality is `municipality`. The region is NY when `county` names New York ("Rockland, NY" and "Orange (NY)": Suffern, Warwick, and Greenwood Lake), otherwise NJ.
- **Spaces:** `totalspaces` (unknown on 4 lots).
- **Official page:** `conwebsite` when it's an http(s) address other than NJ Transit's home page (such as a town's or the parking contractor's site); otherwise NJ Transit's [Parking page](https://www.njtransit.com/parking).
- **Not used yet:** the fee and restriction fields are free text, for slice 3.
- **Result on 2026-11-03:** 399 lots published, 32 withheld.

### `njdot-park-ride` (S2-5)

- **Fetch:** the item (ab33be6e4a51439c9ed179809b4d99cf) gives the service URL, then layer 0 and its `editingInfo.dataLastEditDate` (2024-02-28). One query with `outSR=4326` and the fields `OBJECTID`, `pr_Name`, `Municipality`, `County`, and `pr_Capacity`. The contact fields aren't requested.
- **Record ID:** `OBJECTID`. Facility IDs are `njdot-` plus the name's words.
- **Operator:** New Jersey Department of Transportation, `state`. The layer has no owner field; it's NJDOT's own park-and-ride inventory (decided 2026-11-03).
- **Name:** `pr_Name`, trimmed. When two lots have the same name, the lower `OBJECTID` is kept: "Mount Arlington (Howard Boulevard Phase I)" is listed twice, 385 m apart.
- **Locality:** `Municipality`, title-cased ("MONTVILLE TWP" becomes "Montville Twp"). "Dover Annex" says Dover Town, but its point is in Toms River (formerly Dover Township); we show it as published.
- **Spaces:** `pr_Capacity` (unknown on 3 lots). **Kind:** `lot`. **Region:** NJ.
- **Official page:** NJDOT's [Park and Ride Locator](https://dot.nj.gov/transportation/commuter/rideshare/prlocate.shtm). The layer's `URL` field is empty.
- **Matching** (ING-12): an NJDOT lot within 100 m of an NJ Transit lot is that lot, and NJ Transit's record is the primary. On 2026-11-03 that's Fair Lawn (25 m from "Fairlawn DPW"), Elmwood Park, Mount Arlington, and Parsippany (Beverwyck), which NJ Transit records as private, so it stays hidden.
- **Result on 2026-11-03:** 16 records, 12 of them new lots.

## Jersey City (slice 4, ADR-0012)

### `jc-municipal-lots` (S4-2)

- **Fetch:** `https://data.jerseycitynj.gov/api/explore/v2.1/catalog/datasets/municipal-parking-lots/records?limit=100`, OpenDataSoft JSON (`total_count`, `results`). The data date is the dataset's `metas.default.modified` (2020-11-25), from `/catalog/datasets/municipal-parking-lots`. A response whose `total_count` is more than its results fails with `upstream.too_large`.
- **Fields:** `lots` (such as "Lot 52"), `address`, `geopoints`. Not `zip_code`.
- **Record:** the record ID and name are `lots` as published; the facility ID is `jc-` plus its words, such as `jc-lot-52`. Kind `lot`; operator City of Jersey City, `municipal`; locality Jersey City; region NJ; no spaces. The official page is the city's [Parking page](https://www.jerseycitynj.gov/cityhall/public_safety/Parking), which has the Parking Division's phone number.
- **Terms:** the portal's terms and conditions (above). The user reports the city doesn't object (SRC-5, 2026-11-04).

### `nj-parcels-jc-parking` (S4-3)

- **Fetch:** the item (533599bbfbaa4748bf39faf1375a8a9c) gives the service, whose one layer gives the data date (`editingInfo.dataLastEditDate`). Then two queries, stored together (specs/03): the candidates, `PCL_MUN = '0906' AND PROP_CLASS = '15C'` with "PARKING" in `BLDG_DESC` or `FAC_NAME`, with outlines and centroids in WGS 84; and the other public parcels (`PROP_CLASS` starting with 15) on the candidates' blocks, without outlines. Owner names are redacted in the layer and aren't requested.
- **Sites:** candidate parcels on one block whose outlines touch (a corner within 1.5 m) are one site. Its point is the mean of its parcels' centroids.
- **Kept** (ING-13): a site none of whose parcels says railroad or right of way (`R.O.W`, `ROW`, `RAILROAD`), on a block where no public parcel, the site's own included, names a school, college, police, fire house, public housing, post office, court, library, hospital, administrative or office building, community centre, garage (other than a parking garage), park, recreation, church, or cemetery. On 2026-11-04 that's 26 sites: 23 shown as unconfirmed, and 3 that merge into city lots 33, 44, and 49 (ING-14). The first sort (docs/requests) counted 25 unexplained sites; two of them are post office land on block 101, which their own parcels say.
- **Record:** the record ID is the site's first `PAMS_PIN`; the facility ID is `jc-site-` plus that PIN's block and lot, such as `jc-site-14102-12`. The name is the first parcel's `PROP_LOC`, title-cased, such as "179 Montgomery St." Kind `lot`; operator type `unknown` with no name; `confirmed` false; no address line, spaces, or official page; locality Jersey City; region NJ.
- **Matching** (ING-14): a site within 90 m of a `jc-municipal-lots` lot or an `njt-parking-lots` lot is that lot, and the lot is the primary.

## West New York (slice 4, S4-12)

### `wny-parking-lots` (S4-12)

- **Source:** the Town of West New York Parking Utility's [Facilities page](https://www.westnewyorknj.org/pages/parking-services/facilities/), HTML, checked 2026-11-06. The data date is the page's `Last-Modified` header. No terms are stated. **Admitted, terms unstated (ADR-0014), 2026-11-06**, without asking first; it comes out if West New York objects (SRC-10).
- **What it lists:** 10 municipal lots, each with a name, where it is (cross streets or an address), and its spaces; and, for all of them, meters Monday to Saturday 9:00am to 9:00pm at "20-Minute parking = 25¢", permit holders only from 9:01pm to 9:00am, and an overnight pass for others at $10.00 a night from 9:01pm to 9:00am. It also lists three reserved garages (62nd Street, Fillmore, Meridia), monthly only with waiting lists, which we leave out. The page has no staff email addresses.
- **Locations:** the page has no coordinates. Each lot was placed once, on 2026-11-06, on the public parcel the tax records describe as parking that matches the page's description (seven lots, such as the Parking Authority's parcel at 5717 Madison St "behind Miller Stadium"; the 67th Street lot's parcel is class 15F, "municipal / parking area"), or else with the State's geocoder (the 54th Street lot, midway along Park Avenue between 54th and 55th). OpenStreetMap was only a cross-check (SRC-9). The "6701 Dewey Triangle Lot" (15 spots) couldn't be placed with confidence and is left out. A lot the page adds later that isn't placed counts as a row that can't be read (ING-10).
- **Record:** name as published; the address line is the page's "where"; operator West New York Parking Utility, `municipal`; spaces from the page; metered hours from the page's sentence (no time limit, since "maximum allotment varies per lot"); rates: 75¢ per hour Monday to Saturday 9:00am to 9:00pm (the page's 25¢ per 20 minutes, shown per hour), and an overnight pass, $10.00, every day 9:01pm to 9:00am. If the page's wording for the hours, rate, or pass changes, the run fails and changes nothing.
- **Result on 2026-11-06:** 9 lots, 932 spaces.

## New Jersey municipalities (researched 2026-11-03)

Searched: ArcGIS Online for layers titled "parking" in 34 of NJ's largest cities and best-known parking towns; Socrata (none of the 83 portals with a parking dataset is in NJ); and each city's parking authority or utility. **No NJ city publishes its municipal lots as open data**, apart from Jersey City's 7 lots from 2020 (above) and Hoboken's small layer. Elsewhere, lot lists are on city or authority websites only.

Many of these authorities' lots at train stations are already in NJ Transit's Parking Lot Database: it lists 189 lots owned by municipalities.

**Opened and checked:**

| City | What exists | Format and terms | Status |
|---|---|---|---|
| Hoboken | [Municipal Garages and Lots](https://www.hobokennj.gov/resources/municipal-garages) page: Garage B (28 2nd Street, 829 spaces), Garage D (215 Hudson Street, 488), Garage G (315 Hudson Street, 488), Midtown (371 4th Street, 730), Lot 3 (1301 Jefferson Street) and Lot 4 (1500 Park Avenue, permit lots), hours, contacts, and an availability table | An HTML page with no coordinates. The availability table is embedded from a third-party table service (not opened). No terms stated on the page | **Candidate (SRC-7).** Could be Admitted, terms pending (ADR-0011) once Hoboken is asked. It would be a small, hand-checked list, geocoded once. Rechecked 2026-11-06: capacities 829 (B), 488 (D), 488 (G), and 730 (Midtown); Garage G's transient parking said "Not Available"; Lots 3 and 4 are monthly permit lots ($185 and $200). The tax records list the garages under other addresses and wording: Garage B at 112 River St ("GARAGE#B-810 PS"), Garage D at 210 River St ("GARAGE#D-486 PS"), Midtown at 328 Clinton St ("MIDTOWN GARAGE"), all class 15C; Lot 3 is 15C ("PARKING LOT" beside a playground); Lot 4 is class 1, taxable vacant land. OpenStreetMap places Garage G ("Municipal Lot G"). The page lists staff email addresses, which we don't copy. |
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

## State parcels and tax records (checked 2026-11-04)

The statewide parcel layer (above) carries each parcel's tax record: its property class and the assessor's free-text description, which sometimes says parking.

- **Counts:** Jersey City has 139 public parcels (class 15C) described as parking ("PARKING AREA" or "PARKING LOT" in `BLDG_DESC` or `FAC_NAME`) and 459 commercial ones (class 4A). New Jersey has 2,429 public ones.
- **Cross-check, Jersey City block 11401** (1st Street to Newark Avenue, between Jersey Avenue and Erie Street):
  - 253 and 247 First Street and 174 Newark Avenue are 15C, "PARKING AREA". That's Municipal Lot 52: the city's Municipal Parking Lots dataset places it on the 174 Newark Avenue parcel, and OpenStreetMap has "Municipal Lot 52" there with hours of 08:00–19:00 daily, entered by volunteers.
  - 257 and 259 First Street and 184 Newark Avenue, nearer Jersey Avenue, are 4A, "PARKING LOT": a private lot.
- **Limits:**
  - A parcel isn't a facility. One lot can span several parcels; 468 to 480 Manila Avenue is 10.
  - "Parking area" on public land often serves a public building, such as a post office, police station, or school, rather than the public.
  - Descriptions are free text, entered by each town's assessor.
  - There are no hours, rates, spaces, or rules on who may park. With owner names redacted, it doesn't say which public body holds a 15C parcel.
- **Use:** finding candidate public lots near a place, to confirm with each operator before anything is admitted (slice 4, SRC-5, SRC-8). It isn't a source of facility details.
- **Hudson County check (2026-11-06):** with the wording widened to what Hudson's assessors use ("PRKNG", "GARAGE#…", "810 PS" for parking spaces), the 12 towns have 243 public parcels described as parking. The Jersey City rule (ING-13) would show 25 sites in Jersey City and 35 in the other towns: Bayonne 6, North Bergen 6, Hoboken 6, Harrison 4, Union City 4, West New York 4, East Newark 2, Guttenberg, Secaucus, and Weehawken 1 each, Kearny 0. Against the 18 public lots we already know in the county (NJ Transit's 6 with spaces, Jersey City's 7, Hoboken's 3 garages and 2 lots), the layer has a site within 90 m of 15. The rule would show 6 of those, and sorts out 9 because something else public is on the block (Hoboken's three garages, Jersey City's Lots 15, 39, and 52, and others). It misses 3: NJ Transit's Tonnelle Avenue lot, the Port Authority's North Bergen park and ride, and Hoboken's Lot 4. So outside Jersey City the rule finds real lots but hides many; wording and recall differ by town.
- **Jersey City candidates (2026-11-04):** the 139 parcels make 73 sites, in [docs/requests/jersey-city-parking-candidates.csv](../docs/requests/jersey-city-parking-candidates.csv) for the Parking Division to confirm. All 7 city lots and NJ Transit's 2 Jersey City lots are among them (8 sites); 25 have no obvious use, 35 are next to a school, public building, park, or church, and 5 are railroad or right of way. How it was built is in [docs/requests/README.md](../docs/requests/README.md).

## Address search (ADR-0013, checked 2026-11-06)

Not facility sources: nothing from them is stored. They turn what someone types into a point to search from.

| Service or data | Publisher | Endpoint | Used for | Terms | Notes |
|---|---|---|---|---|---|
| NYC GeoSearch | NYC Planning, on the City's Property Address Directory | `https://geosearch.planninglabs.nyc/v2/autocomplete?text=…` ([docs](https://labs-geosearch-docs.netlify.app/)), GeoJSON with each match's label and point | New York City addresses | None stated on its documentation | No key. Allows browsers to call it (`Access-Control-Allow-Origin: *`). Doesn't return towns or neighbourhoods as places |
| NJ_Geocode | NJ Office of GIS | `https://geo.nj.gov/arcgis/rest/services/Tasks/NJ_Geocode/GeocodeServer`: `/suggest?text=…` gives labels and keys, `/findAddressCandidates?SingleLine=…&magicKey=…&outSR=4326` the point ([about](https://www.nj.gov/njgin/edata/geocoding/)) | New Jersey addresses | The State's [Legal Statement & Disclaimers](https://www.nj.gov/nj/legal.shtml) | No key. Allows browsers to call it. Source data updated monthly. Returns nothing for a town name alone |
| Municipal Boundaries of NJ | NJOGIS | ArcGIS item a1b13541f0484415b06cf9c8969bfd6c, `MUN_LABEL`, `COUNTY`, `POP2020`, centroids | The 564 New Jersey towns in the built-in list | Same as the parcel layer: disclaimer, credit to NJOGIS requested | Data edited 2025-04-10 |
| 2020 Neighborhood Tabulation Areas | NYC Planning | [9nt8-h7nd](https://data.cityofnewyork.us/d/9nt8-h7nd), GeoJSON | New York City's boroughs and neighbourhood names in the built-in list | NYC Open Data | Updated 2026-11-02. Residential areas only; names like "Astoria (Central)" are split and merged into "Astoria" |

## OpenStreetMap (checked 2026-11-06)

- **Access:** the Overpass API (`overpass-api.de`, plus public mirrors), JSON with each feature's tags and centre; OpenStreetMap's own API for small boxes. The public Overpass instances are shared: they answered "at capacity" (502) on 2026-11-03 and 2026-11-04, and their error page says heavy or automated use belongs elsewhere. Volunteers edit the data continuously.
- **Fields:** `amenity=parking`, with optional `access`, `parking` (surface, multi-storey, and so on), `operator`, `name`, `fee`, `capacity`, and `opening_hours`.
- **Terms:** the [Open Database License](https://www.openstreetmap.org/copyright). The data may be copied, shared, and adapted with credit to OpenStreetMap and its contributors, saying it's under that license; a result that alters or builds on the data may be shared only under the same license (SRC-9). The app's map already credits OpenStreetMap (WEB-7).
- **Hudson County, 2026-11-06:** 1,164 parking features. Access: 653 untagged, 342 `private`, 123 `customers`, 28 `yes`, 7 `permissive`, 7 `permit`, 4 `no`. 74 have a name, 73 an operator (mostly private companies, such as SP+, LAZ, and Metropolis), 104 a capacity, 126 a fee tag, and 8 opening hours. No feature names the Jersey City Parking Authority as operator.
- **Against the 18 known public lots in Hudson County:** a feature within 90 m of 12, of which 9 are tagged or named as public (such as "Municipal Lot 52", "Municipal Parking Garage B", "North Bergen Park & Ride"). Tags can be wrong: NJ Transit's West Side Avenue lot is tagged `access=customers`. A query that keeps only features tagged `access=public`, a parking type, or certain operators finds 7 of the 18, because many lots carry only a name; and its operator list included private companies (SP+, Metropolis, ParkFast).
- **What it adds:** Hoboken's Garage G location, and volunteer-entered hours for Jersey City's Lots 52 (08:00–19:00 daily) and 44.
- **Status: Later, as a supplement** for names, hours, and cross-checks of lots we have from their operators, not as a main source. Using its data in ours waits on SRC-9.

## Commercial parking data (not checked)

Parkopedia, INRIX, and Google Places sell parking data through paid, enterprise APIs. None was opened or priced. They'd need a contract, they list private garages too, and their terms would depend on PRD-6 (whether the app is commercial). Third-party listing sites aren't sources (above).

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
