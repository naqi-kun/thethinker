-- Web Push notifications: daily outfit reminder + pre-event "what to wear"
-- reminders, both driven by the user's connected calendar.

-- One row per device/browser subscription. The push service endpoint uniquely
-- identifies a subscription, so re-subscribing the same device upserts on it.
CREATE TABLE push_subscriptions (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   TEXT        NOT NULL UNIQUE,
    p256dh     TEXT        NOT NULL,
    auth       TEXT        NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX push_subscriptions_user_id_idx ON push_subscriptions (user_id);

-- Per-user notification preferences. daily_time is interpreted in the user's
-- timezone (IANA name) so reminders fire at the right local minute.
CREATE TABLE notification_preferences (
    user_id                 UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    daily_enabled           BOOLEAN NOT NULL DEFAULT true,
    daily_time              TEXT    NOT NULL DEFAULT '08:00',
    event_reminders_enabled BOOLEAN NOT NULL DEFAULT true,
    event_lead_minutes      INTEGER NOT NULL DEFAULT 60,
    timezone                TEXT    NOT NULL DEFAULT 'UTC'
);

-- Idempotency log: one row per (user, kind, dedup_key). The UNIQUE constraint
-- makes the dispatch retry-safe — an insert that conflicts means "already sent".
-- daily dedup_key = the user-local date (YYYY-MM-DD); event dedup_key = event ID.
CREATE TABLE sent_notifications (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind      TEXT        NOT NULL,
    dedup_key TEXT        NOT NULL,
    sent_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, kind, dedup_key)
);
