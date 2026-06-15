-- Add an editable display name to users (KAN-84). Defaults to empty string so
-- existing rows stay valid; the client falls back to an email-derived name when blank.
ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT '';
