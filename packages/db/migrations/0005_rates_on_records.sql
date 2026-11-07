-- Slice 4 (S4-12): a source's rates travel with its records, like metered periods, so the facility rebuild can
-- write facility_rate (specs/03). Each entry: days (bit mask), startsAt, endsAt, kind, upToMinutes, amountMinor,
-- currency. Money is minor units plus a currency, never a float (CLAUDE.md rule 11).
alter table source_record add column rates jsonb not null default '[]';

-- West New York sells an overnight pass ($10, 9:01pm to 9:00am), which isn't a per-hour or up-to-duration rate.
alter table facility_rate drop constraint facility_rate_kind_check;
alter table facility_rate add constraint facility_rate_kind_check
  check (kind in ('per_hour', 'up_to_duration', 'daily_max', 'monthly_permit', 'overnight_pass'));
