-- Slice 0 foundation (specs/03-data-model.md). No table here stores a user's location (PRIV-1).
create extension if not exists postgis;

-- Data sources the worker knows. Upserted by the worker from its registry (ATT-3 reads it in slice 1).
create table source (
  id text primary key,
  publisher text not null,
  title text not null,
  dataset_url text not null,
  terms_url text not null,
  credit_text text,
  modification_codes text[] not null default '{}',
  data_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The raw bytes of one upstream response (ING-2).
create table source_snapshot (
  id bigint generated always as identity primary key,
  source_id text not null references source (id),
  fetched_at timestamptz not null,
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  content_type text not null,
  byte_size integer not null check (byte_size >= 0),
  upstream_updated_at timestamptz,
  body bytea not null
);
create index source_snapshot_source_fetched on source_snapshot (source_id, fetched_at desc);

-- One row per ingestion run (ING-4).
create table ingestion_run (
  id bigint generated always as identity primary key,
  source_id text not null references source (id),
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null check (status in ('running', 'succeeded', 'unchanged', 'failed')),
  error_code text,
  snapshot_id bigint references source_snapshot (id) on delete set null,
  rows_read integer,
  rows_written integer,
  rows_withdrawn integer,
  check ((status = 'failed') = (error_code is not null)),
  check ((status = 'running') = (finished_at is null))
);
create index ingestion_run_source_started on ingestion_run (source_id, started_at desc);
