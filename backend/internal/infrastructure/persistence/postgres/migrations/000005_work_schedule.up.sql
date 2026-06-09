-- Work schedule, working time, and holidays (KAN-49 criteria 6 & 7), plus an
-- ignore flag on calendar events (criterion 5).

CREATE TABLE work_schedules (
    user_id      UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    working_days SMALLINT[]  NOT NULL DEFAULT '{1,2,3,4,5}', -- 0=Sun … 6=Sat
    work_start   TEXT        NOT NULL DEFAULT '09:00',
    work_end     TEXT        NOT NULL DEFAULT '17:00',
    holidays     DATE[]      NOT NULL DEFAULT '{}'
);

ALTER TABLE calendar_events
    ADD COLUMN ignored BOOLEAN NOT NULL DEFAULT false;
