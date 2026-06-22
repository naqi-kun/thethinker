-- Repair production DBs stamped at 20260622090000 before the pattern migration
-- (20260621000000) could run. Idempotent on fresh installs that already have pattern.
DO $$ BEGIN
    CREATE TYPE clothing_pattern AS ENUM (
        'solid',
        'striped',
        'plaid',
        'floral',
        'graphic',
        'animal',
        'polka_dot'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE wardrobe_items
    ADD COLUMN IF NOT EXISTS pattern clothing_pattern NOT NULL DEFAULT 'solid';
