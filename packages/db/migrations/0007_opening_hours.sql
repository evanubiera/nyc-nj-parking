-- Opening hours travel with source records, like rates (0005), so the facility rebuild can write facility_hours.
-- Each entry: days (bit mask, Monday = 1 through Sunday = 64), opensAt, closesAt ("HH:MM", local wall-clock time;
-- "24:00" closes at midnight). Harrison's garage is the first source to state them ("Open 24/7").
alter table source_record add column opening_hours jsonb not null default '[]';
