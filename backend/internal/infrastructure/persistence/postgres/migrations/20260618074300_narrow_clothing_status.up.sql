-- Narrow the clothing_status enum to three states: clean, worn, in_laundry.
-- The washing/drying sub-states were never written by the app (the laundry flow
-- only ever sets in_laundry), so this collapses any stragglers and drops them.
-- Postgres can't remove a value from an enum in place, so recreate the type.

-- Collapse any legacy laundering sub-states before narrowing the enum.
UPDATE wardrobe_items SET status = 'in_laundry' WHERE status IN ('washing', 'drying');

ALTER TYPE clothing_status RENAME TO clothing_status_old;

CREATE TYPE clothing_status AS ENUM ('clean', 'worn', 'in_laundry');

ALTER TABLE wardrobe_items
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE clothing_status USING status::text::clothing_status,
    ALTER COLUMN status SET DEFAULT 'clean';

DROP TYPE clothing_status_old;
