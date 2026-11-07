# 03 Data model

PostgreSQL 18 with PostGIS 3.6 (ADR-0003). Instants are stored as `timestamptz` in UTC. Opening hours and rate periods are local wall-clock times, interpreted in the facility's IANA time zone (`America/New_York` for everything in NY and NJ). No table stores a user's location (PRIV-1).

## Slice 0 tables

Created by packages/db/migrations/0001_foundation.sql.

### `schema_migrations`
| Column | Type | Notes |
|---|---|---|
| version | text, primary key | File name without `.sql`, such as `0001_foundation` |
| applied_at | timestamptz | |

### `source`
One row per data source the worker knows. The worker upserts these rows from its registry when it starts. The API reads them for credits (ATT-3, slice 1).

| Column | Type | Notes |
|---|---|---|
| id | text, primary key | Stable ID, such as `nyc-facdb-dot` |
| publisher | text | Publisher's name as published, such as "Department of City Planning (DCP)" |
| title | text | Dataset title as published |
| dataset_url | text | The dataset's page |
| terms_url | text | The terms that apply |
| credit_text | text, nullable | Exact credit wording, only where a publisher requires it |
| modification_codes | text[] | What we change, as codes (the web app has the text), such as `hours_parsed` or `merged_across_sources` |
| data_updated_at | timestamptz, nullable | The source's own "data updated" time from its metadata, at the last successful run |
| created_at, updated_at | timestamptz | |

### `source_snapshot`
The raw bytes of one upstream response (ING-2).

| Column | Type | Notes |
|---|---|---|
| id | bigint identity, primary key | |
| source_id | text, references `source` | |
| fetched_at | timestamptz | |
| content_sha256 | text | Hex. Used to skip unchanged data (ING-7) |
| content_type | text | As sent by the upstream server |
| byte_size | integer | |
| upstream_updated_at | timestamptz, nullable | From the source's metadata, when it has a "data updated" time |
| body | bytea | Exactly what was received |

### `ingestion_run`
One row per run (ING-4).

| Column | Type | Notes |
|---|---|---|
| id | bigint identity, primary key | |
| source_id | text, references `source` | |
| started_at, finished_at | timestamptz | `finished_at` is null while the run is going |
| status | text | `running`, `succeeded`, `unchanged`, or `failed` |
| error_code | text, nullable | Set when `failed`, and only then: `upstream.timeout`, `upstream.network`, `upstream.http_status`, `upstream.too_large`, `normalize.unexpected_format`, `normalize.invalid_record`, `normalize.empty`, `run.abandoned`, or `run.unexpected` |
| snapshot_id | bigint, nullable, references `source_snapshot` | |
| rows_read, rows_written, rows_withdrawn | integer, nullable | |

A run left as `running` by a crash is marked `failed` with `run.abandoned` when the next run of that source starts.

## Slice 1

Created by packages/db/migrations/0002_facilities.sql (S1-2). Reviewed by the user on 2026-11-03: hours from parking meters are metered periods, kept apart from opening hours.

### `source_record`
One facility as one source describes it, after normalizing. Each successful run of a source replaces that source's rows, and the facility tables below are then rebuilt from every source's rows (see "How facilities are built"). Added while building S1-5: it lets a run of either source rebuild the merged facilities, whichever source ran first.

| Column | Type | Notes |
|---|---|---|
| source_id, record_id | text, primary key together | The Facilities Database `uid`, or the meters' field name in match-token form, such as `avenue-m` |
| facility_key | text | The facility ID this record would give, such as `nyc-dot-avenue-m` |
| priority | smallint | Lower wins. 1 for the Facilities Database, 2 for the meters |
| name, kind, operator_name, operator_type, address_line, locality, region, time_zone, location, spaces, official_url | as in `facility` | |
| match_tokens | text[] | Lower-case name words for matching, such as `{bensonhurst,1}` |
| meter_periods | jsonb | Parsed metered periods (meters only) |
| first_seen_at, last_seen_at | timestamptz | |

### `facility`
| Column | Type | Notes |
|---|---|---|
| id | text, primary key | Our ID, such as `nyc-dot-delancey-essex` |
| name | text | As published |
| kind | text | `garage`, `lot`, or `field` |
| operator_name | text | Such as "NYC Department of Transportation" |
| operator_type | text | `municipal`, `county`, `state`, `transit_agency`, or `public_authority` (ADR-0007) |
| address_line | text, nullable | The facility's public street address, when a source gives one |
| locality, region | text | `locality` is a borough or municipality; `region` is `NY` or `NJ` |
| time_zone | text | IANA name |
| location | geography(Point, 4326) | GiST index |
| spaces | integer, nullable | When a source gives it |
| official_url | text | The operator's page for this facility |
| status | text | `active` or `withdrawn` (ING-8) |
| first_seen_at, last_seen_at, withdrawn_at | timestamptz | |

### `facility_source`
Links a facility to each source record it was built from, because one facility can appear in more than one source.

| Column | Type | Notes |
|---|---|---|
| source_id, source_record_id | text, primary key together | Such as `nyc-facdb-dot` and the Facilities Database `uid` |
| facility_id | text, references `facility` | |

### `facility_meter_period`
When payment is required at the meters, and the time limit. Built from the meters' `meter_hours` text, such as "4HR Pas Mon-Sat 0700-2200". This isn't when a facility is open (WEB-6).

| Column | Type | Notes |
|---|---|---|
| facility_id | text | |
| days | smallint | Bit mask: Monday = 1 through Sunday = 64 |
| starts_at, ends_at | time | Local time. `ends_at` at or before `starts_at` means the period ends after midnight |
| max_stay_minutes | integer, nullable | The time limit, such as 240 for "4HR" |
| vehicle_class | text, nullable | `passenger` ("Pas") or `commercial` ("Com"); null when the text names neither |
| source_text | text | The original `meter_hours` value |

A `meter_hours` value that doesn't parse (the data has at least one, "Rate NOT Available …") produces no period and isn't shown; the facility keeps its other data. Meters in one field can have different limits for the same times (Avenue M has 4-hour and 15-hour meters), so a facility can have several periods that differ only in `max_stay_minutes`.

### `facility_hours`
Opening hours. Filled only from a source that states them; none is admitted yet (SRC-1).

| Column | Type | Notes |
|---|---|---|
| facility_id | text | |
| days | smallint | Bit mask: Monday = 1 through Sunday = 64 |
| opens_at, closes_at | time | Local time. `closes_at` at or before `opens_at` means the period ends after midnight |

### `facility_rate`
Rates by time of day and length of stay. Money is always minor units plus a currency, never a float.

| Column | Type | Notes |
|---|---|---|
| facility_id | text | |
| days | smallint | Same bit mask as above |
| starts_at, ends_at | time | Local time when this rate applies |
| kind | text | `per_hour`, `up_to_duration`, `daily_max`, or `monthly_permit` |
| up_to_minutes | integer, nullable | For `up_to_duration` |
| amount_minor | integer | Cents |
| currency | char(3) | `USD` |

## How facilities are built

Each successful run of a source, inside its transaction (ING-3):

1. Normalize the snapshot into source records. Rows that are excluded on purpose (inactive meters, meters with no field name) aren't errors. Rows that should give a record but can't (no coordinates, outside NYC) are counted as invalid. If invalid rows outnumber records, or there are no records, the run fails with `normalize.invalid_record` or `normalize.empty` and changes nothing (ING-10).
2. Replace that source's `source_record` rows. Records it no longer lists are deleted and counted as withdrawn.
3. Rebuild the facility tables from every source's records, under an advisory lock:
   - Records are taken in priority order. A record joins an existing facility when that facility has no record from the same source yet, one of its records has a matching name, and that record is within 750 m. The nearest such facility wins. Otherwise the record starts a new facility.
   - Names match when their match tokens are the same letters ("SUNNY SIDE" and "Sunnyside") or one's words are all in the other's ("White Plains Road" and "White Plains Road & Maran Place"). Numbers count as words, so "Ditmars #1" never matches "Ditmars #2".
   - 750 m because correct matches in the sources on 2026-11-03 were up to 497 m apart (the Gowanus field runs for blocks under the expressway), and the name has to match too.
   - A facility's ID, name, address, and location come from its primary record, the first in priority order. When a facility's primary changes (for example, the Facilities Database arrives after the meters), its ID can change; the old ID is withdrawn.
   - Facilities that no record supports any more are marked withdrawn, with the time (ING-8). A withdrawn facility that comes back is active again under the same ID.
   - From slice 2: records match only within the same region (NY or NJ), so a Staten Island field can't merge with a lot across the Arthur Kill. An NJ Transit record and an NJDOT record within 100 m of each other match whatever their names (ING-12), because the two sources name the same lot differently ("Fairlawn DPW" and "Fair Lawn Commuter Parking Lot", 25 m apart).
   - From slice 2: a facility with a withheld record (ING-11) isn't written at all. Its records stay in `source_record`, and a facility that was published under that ID is withdrawn.

## Slice 2

Added by packages/db/migrations/0003_nj_lots.sql (S2-2).

### `source_record`, new columns

| Column | Type | Notes |
|---|---|---|
| lot_number | text, nullable | Set only when the source has several lots with the same name (REC-8), such as "2" for Mountain View (Wayne)'s second rail lot |
| withheld_reason | text, nullable | `private_owner` when the source records the owner as private (ING-11). The record still takes part in matching, so the same lot from another source isn't published |

### `facility`, new column

| Column | Type | Notes |
|---|---|---|
| lot_number | text, nullable | From the primary record |

## Slice 4

Added by packages/db/migrations/0004_unconfirmed_sites.sql (S4-1), for ADR-0012.

### `source_record` and `facility`, changes

| Column | Change | Notes |
|---|---|---|
| confirmed | new, boolean, not null, default true | False for a candidate site from tax records (REC-9). A facility is confirmed when any of its records is |
| operator_type | also allows `unknown` | Only when `confirmed` is false |
| operator_name | now nullable | Null only when `operator_type` is `unknown` |
| official_url | now nullable | Null only when `confirmed` is false |

Added by packages/db/migrations/0005_rates_on_records.sql (S4-12): `source_record.rates`, jsonb, the rates a source states (days, starts and ends, kind, up-to minutes, minor units, currency); the rebuild writes the first record's rates, in priority order, to `facility_rate`. `facility_rate.kind` also allows `overnight_pass` (West New York's $10 pass, 9:01pm to 9:00am).

The State's parcel layer is fetched with several queries (the candidates, then the neighbours in parts, since the layer refuses long query URLs), so its snapshot body is a JSON object holding every response exactly as received, as strings: `{"candidates": "…", "neighbours": ["…", "…"]}` (ADR-0012, ADR-0015). A web page's email addresses are removed before it's stored (ING-2).
