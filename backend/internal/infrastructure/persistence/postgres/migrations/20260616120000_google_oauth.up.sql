-- Google account integration (KAN-97).
-- Link a user to their Google identity for "Sign in with Google", and store the
-- OAuth refresh token alongside the access token so synced Google Calendar feeds
-- can be refreshed without re-consent.

-- google_id is the Google account subject ("sub" claim). Nullable: email/password
-- users have none. UNIQUE so one Google account maps to one user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

ALTER TABLE calendar_connections ADD COLUMN IF NOT EXISTS refresh_token TEXT NOT NULL DEFAULT '';
