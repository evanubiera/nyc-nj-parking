-- Slice 1 facilities (specs/03-data-model.md). Locations here are facility locations, never a user's (PRIV-1).

-- One normalized record per facility per source, replaced on each successful run of that source.
-- The facility tables below are rebuilt from these records (specs/03, "How facilities are built").
create table source_record (
  source_id text not null references source (id),
  record_id text not null,
  facility_key text not null,
  priority smallint not null,
  name text not null,
  match_tokens text[] not null,
  kind text not null check (kind in ('garage', 'lot', 'field')),
  operator_name text not null,
  operator_type text not null check (operator_type in ('municipal', 'county', 'state', 'transit_agency', 'public_authority')),
  address_line text,
  locality text not null,
  region text not null check (region in ('NY', 'NJ')),
  time_zone text not null,
  location geography (Point, 4326) not null,
  spaces integer check (spaces >= 0),
  official_url text not null,
  meter_periods jsonb not null default '[]',
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  primary key (source_id, record_id)
);

create table facility (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('garage', 'lot', 'field')),
  operator_name text not null,
  operator_type text not null check (operator_type in ('municipal', 'county', 'state', 'transit_agency', 'public_authority')),
  address_line text,
  locality text not null,
  region text not null check (region in ('NY', 'NJ')),
  time_zone text not null,
  location geography (Point, 4326) not null,
  spaces integer check (spaces >= 0),
  official_url text not null,
  status text not null default 'active' check (status in ('active', 'withdrawn')),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  withdrawn_at timestamptz,
  check ((status = 'withdrawn') = (withdrawn_at is not null))
);
create index facility_location on facility using gist (location);

create table facility_source (
  source_id text not null,
  source_record_id text not null,
  facility_id text not null references facility (id),
  primary key (source_id, source_record_id),
  foreign key (source_id, source_record_id) references source_record (source_id, record_id) on delete cascade
);
create index facility_source_facility on facility_source (facility_id);

-- When payment is required at the meters, and the time limit. Not opening hours (WEB-6).
create table facility_meter_period (
  facility_id text not null references facility (id),
  days smallint not null check (days between 1 and 127),
  starts_at time not null,
  ends_at time not null,
  max_stay_minutes integer check (max_stay_minutes > 0),
  vehicle_class text check (vehicle_class in ('passenger', 'commercial')),
  source_text text not null
);
create index facility_meter_period_facility on facility_meter_period (facility_id);

-- Opening hours. Filled only from a source that states them; none is admitted yet (SRC-1).
create table facility_hours (
  facility_id text not null references facility (id),
  days smallint not null check (days between 1 and 127),
  opens_at time not null,
  closes_at time not null
);
create index facility_hours_facility on facility_hours (facility_id);

-- Rates by time of day and length of stay. Money is minor units plus a currency (CLAUDE.md rule 11).
create table facility_rate (
  facility_id text not null references facility (id),
  days smallint not null check (days between 1 and 127),
  starts_at time not null,
  ends_at time not null,
  kind text not null check (kind in ('per_hour', 'up_to_duration', 'daily_max', 'monthly_permit')),
  up_to_minutes integer check (up_to_minutes > 0),
  amount_minor integer not null check (amount_minor >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$')
);
create index facility_rate_facility on facility_rate (facility_id);
