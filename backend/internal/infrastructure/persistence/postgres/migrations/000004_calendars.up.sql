-- Multi-calendar model (KAN-49): a user may add one or more calendars,
-- starting with ICS URL feeds. Replaces the single-row calendar_connections
-- assumption for the new flow; the legacy OAuth table is left untouched.

CREATE TABLE calendars (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL DEFAULT '',
    source     TEXT        NOT NULL,
    ics_url    TEXT        NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX calendars_user_id_idx ON calendars (user_id);

-- Tie cached events to their owning calendar and capture end time / all-day flag.
ALTER TABLE calendar_events
    ADD COLUMN calendar_id UUID REFERENCES calendars(id) ON DELETE CASCADE,
    ADD COLUMN ends_at     TIMESTAMPTZ,
    ADD COLUMN all_day     BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX calendar_events_calendar_id_idx ON calendar_events (calendar_id);
