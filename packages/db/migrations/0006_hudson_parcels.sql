-- Slice 4 (ADR-0015): `nj-parcels-hudson-parking` replaces `nj-parcels-jc-parking`, for all of Hudson County. The old
-- source's records (and with them their facility links), runs, and snapshots go. A facility no other record supports
-- is withdrawn until the new source's first run brings it back: Jersey City's sites keep their IDs (ING-8).
delete from source_record where source_id = 'nj-parcels-jc-parking';
delete from ingestion_run where source_id = 'nj-parcels-jc-parking';
delete from source_snapshot where source_id = 'nj-parcels-jc-parking';
delete from source where id = 'nj-parcels-jc-parking';
update facility set status = 'withdrawn', withdrawn_at = now()
where status = 'active' and not exists (select 1 from facility_source where facility_source.facility_id = facility.id);
