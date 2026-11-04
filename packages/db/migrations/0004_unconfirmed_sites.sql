-- Slice 4 (ADR-0012, specs/03 "Slice 4"): unconfirmed sites from tax records. Such a site has no recorded
-- owner and no official page, so its operator type is `unknown`, and it's marked as not confirmed.

alter table source_record add column confirmed boolean not null default true;
alter table facility add column confirmed boolean not null default true;

alter table source_record drop constraint source_record_operator_type_check;
alter table source_record add constraint source_record_operator_type_check
  check (operator_type in ('municipal', 'county', 'state', 'transit_agency', 'public_authority', 'unknown'));
alter table facility drop constraint facility_operator_type_check;
alter table facility add constraint facility_operator_type_check
  check (operator_type in ('municipal', 'county', 'state', 'transit_agency', 'public_authority', 'unknown'));

alter table source_record alter column operator_name drop not null;
alter table facility alter column operator_name drop not null;
alter table source_record alter column official_url drop not null;
alter table facility alter column official_url drop not null;

-- REC-9: only an unconfirmed site may have an unknown operator, no operator name, or no official page.
alter table source_record add constraint source_record_unconfirmed_check check (
  (operator_type = 'unknown') = (operator_name is null)
  and (operator_type <> 'unknown' or not confirmed)
  and (official_url is not null or not confirmed));
alter table facility add constraint facility_unconfirmed_check check (
  (operator_type = 'unknown') = (operator_name is null)
  and (operator_type <> 'unknown' or not confirmed)
  and (official_url is not null or not confirmed));
