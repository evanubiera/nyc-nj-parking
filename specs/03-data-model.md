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
| error_code | text, nullable | Set when `failed`, and only then: `upstream.timeout`, `upstream.network`, `upstream.http_status`, `normalize.invalid_record`, `run.abandoned`, or `run.unexpected` |
| snapshot_id | bigint, nullable, references `source_snapshot` | |
| rows_read, rows_written, rows_withdrawn | integer, nullable | |

A run left as `running` by a crash is marked `failed` with `run.abandoned` when the next run of that source starts.

## Slice 1 draft (for review)

These tables arrive with S1-2. Names and columns may change in review.

### `facility`
| Column | Type | Notes |
|---|---|---|
| id | text, primary key | Our ID, such as `nyc-dot-delancey-essex` |
| name | text | As published |
| kind | text | `garage`, `lot`, or `field` |
| operator_name | text | Such as "NYC Department of Transportation" |
| operator_type | text | `municipal`, `county`, `state`, `transit_agency`, or `public_authority` (ADR-0007) |
| address_line, locality, region | text | The facility's public street address. `locality` is a borough or municipality; `region` is `NY` or `NJ` |
| time_zone | text | IANA name |
| location | geography(Point, 4326) | GiST index |
| spaces | integer, nullable | When a source gives it |
| hours_text | text, nullable | The source's original hours text, kept next to the parsed schedule |
| official_url | text | The operator's page for this facility |
| status | text | `active` or `withdrawn` (ING-8) |
| first_seen_at, last_seen_at, withdrawn_at | timestamptz | |

### `facility_source`
Links a facility to each source record it was built from, because one facility can appear in more than one source.

| Column | Type | Notes |
|---|---|---|
| source_id, source_record_id | text, primary key together | Such as `nyc-facdb-dot` and the Facilities Database `uid` |
| facility_id | text, references `facility` | |

### `facility_hours`
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
