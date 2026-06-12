ALTER TABLE wardrobe_items
    ADD COLUMN deleted_at TIMESTAMPTZ;

CREATE TYPE time_of_day AS ENUM ('morning', 'afternoon', 'evening');

CREATE TABLE outfit_history (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id       TEXT,
    occasion         TEXT,
    worn_on          DATE        NOT NULL,
    time_of_day      time_of_day NOT NULL,
    weather_snapshot JSONB,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_outfit_history_user_id_id ON outfit_history (user_id, id DESC);

CREATE TABLE outfit_history_items (
    outfit_history_id UUID NOT NULL REFERENCES outfit_history(id) ON DELETE CASCADE,
    item_id           UUID NOT NULL REFERENCES wardrobe_items(id),
    image_url         TEXT NOT NULL DEFAULT '',
    category          TEXT NOT NULL,
    sub_type          TEXT NOT NULL,
    color             TEXT NOT NULL,
    fit               TEXT NOT NULL DEFAULT '',
    season            TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (outfit_history_id, item_id)
);
