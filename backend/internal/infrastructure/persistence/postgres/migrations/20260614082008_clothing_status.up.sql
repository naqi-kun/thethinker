CREATE TYPE clothing_status AS ENUM ('clean', 'worn', 'in_laundry', 'washing', 'drying');

ALTER TABLE wardrobe_items
    ADD COLUMN status clothing_status NOT NULL DEFAULT 'clean';
