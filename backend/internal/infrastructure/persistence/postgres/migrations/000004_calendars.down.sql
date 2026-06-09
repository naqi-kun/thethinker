DROP INDEX IF EXISTS calendar_events_calendar_id_idx;

ALTER TABLE calendar_events
    DROP COLUMN IF EXISTS calendar_id,
    DROP COLUMN IF EXISTS ends_at,
    DROP COLUMN IF EXISTS all_day;

DROP INDEX IF EXISTS calendars_user_id_idx;

DROP TABLE IF EXISTS calendars;
