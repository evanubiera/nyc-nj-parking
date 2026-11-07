-- ING-7: a run records the revision of the adapter's normalizing that produced it. Unchanged upstream data is
-- normalized again when the revision differs, so a change to an adapter's rules reaches the facilities without
-- waiting for the source to change (S4-24). Runs before this migration count as revision 1.
alter table ingestion_run add column revision integer not null default 1;
