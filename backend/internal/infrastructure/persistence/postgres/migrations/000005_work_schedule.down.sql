ALTER TABLE calendar_events
    DROP COLUMN IF EXISTS ignored;

DROP TABLE IF EXISTS work_schedules;
