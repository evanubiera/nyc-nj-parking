-- Slice 2: NJ commuter lots (specs/03-data-model.md, "Slice 2").

-- REC-8: set only when a source has several lots with the same name, such as an NJ Transit station's lots.
alter table source_record add column lot_number text;
alter table facility add column lot_number text;

-- ING-11: a record whose owner is recorded as private is kept, so it still takes part in matching, but a
-- facility with a withheld record is never published.
alter table source_record add column withheld_reason text check (withheld_reason in ('private_owner'));
