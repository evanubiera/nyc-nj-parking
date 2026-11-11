-- REC-11 (ADR-0021): the county or borough each facility is in, such as 'nj-morris' or 'ny-brooklyn', set by the
-- worker when it rebuilds facilities. Null until the next rebuild (`pnpm rebuild`), or for a point outside every area.
alter table facility add column area text;
create index facility_area_idx on facility (area) where status = 'active';
