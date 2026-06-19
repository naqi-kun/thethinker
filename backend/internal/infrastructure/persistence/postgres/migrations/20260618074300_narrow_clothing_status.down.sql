-- Restore the wider clothing_status enum (clean, worn, in_laundry, washing, drying).
-- Existing rows only use the narrowed set, so the cast back is lossless.

ALTER TYPE clothing_status RENAME TO clothing_status_old;

CREATE TYPE clothing_status AS ENUM ('clean', 'worn', 'in_laundry', 'washing', 'drying');

ALTER TABLE wardrobe_items
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE clothing_status USING status::text::clothing_status,
    ALTER COLUMN status SET DEFAULT 'clean';

DROP TYPE clothing_status_old;
