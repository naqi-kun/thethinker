CREATE TYPE clothing_pattern AS ENUM (
    'solid',
    'striped',
    'plaid',
    'floral',
    'graphic',
    'animal',
    'polka_dot'
);

ALTER TABLE wardrobe_items
    ADD COLUMN pattern clothing_pattern NOT NULL DEFAULT 'solid';
