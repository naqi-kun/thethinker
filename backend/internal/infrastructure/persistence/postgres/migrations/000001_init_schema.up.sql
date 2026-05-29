CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_preferences (
    user_id UUID    PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    styles  TEXT[]  NOT NULL DEFAULT '{}',
    answers JSONB   NOT NULL DEFAULT '{}'
);

CREATE TABLE wardrobe_items (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category   TEXT        NOT NULL,
    sub_type   TEXT        NOT NULL,
    color      TEXT        NOT NULL,
    image_url  TEXT        NOT NULL DEFAULT '',
    last_worn  TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX wardrobe_items_user_id_idx ON wardrobe_items (user_id);

CREATE TABLE calendar_connections (
    user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    provider   TEXT        NOT NULL,
    token      TEXT        NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE calendar_events (
    id        TEXT        NOT NULL,
    user_id   UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title     TEXT        NOT NULL,
    type      TEXT        NOT NULL DEFAULT '',
    starts_at TIMESTAMPTZ NOT NULL,
    location  TEXT        NOT NULL DEFAULT '',
    PRIMARY KEY (id, user_id)
);

CREATE INDEX calendar_events_user_starts_idx ON calendar_events (user_id, starts_at);
