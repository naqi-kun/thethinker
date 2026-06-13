-- Postgres cannot drop individual enum values, so rebuild clothing_sub_type
-- without the accessory values. This fails if any wardrobe_items row still
-- references an accessory sub_type — remove those rows before rolling back.
ALTER TABLE wardrobe_items
    ALTER COLUMN sub_type TYPE TEXT USING sub_type::TEXT;

DROP TYPE clothing_sub_type;

CREATE TYPE clothing_sub_type AS ENUM (
    'shirt', 't-shirt', 'sweater', 'hoodie', 'jacket', 'coat',
    'pants', 'jeans', 'shorts', 'skirt', 'dress',
    'shoes', 'sneakers', 'boots', 'suit', 'blazer'
);

ALTER TABLE wardrobe_items
    ALTER COLUMN sub_type TYPE clothing_sub_type USING sub_type::clothing_sub_type;
