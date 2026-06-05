-- Drop defaults so Postgres allows the column type change
ALTER TABLE wardrobe_items
    ALTER COLUMN fit    DROP DEFAULT,
    ALTER COLUMN season DROP DEFAULT;

-- Drop CHECK constraints added in migration 002
ALTER TABLE wardrobe_items
    DROP CONSTRAINT IF EXISTS wardrobe_items_fit_check,
    DROP CONSTRAINT IF EXISTS wardrobe_items_season_check;

CREATE TYPE clothing_category AS ENUM ('formal', 'casual', 'sport');

CREATE TYPE clothing_sub_type AS ENUM (
    'shirt', 't-shirt', 'sweater', 'hoodie', 'jacket', 'coat',
    'pants', 'jeans', 'shorts', 'skirt', 'dress',
    'shoes', 'sneakers', 'boots', 'suit', 'blazer'
);

CREATE TYPE clothing_color AS ENUM (
    'black', 'white', 'grey', 'navy blue', 'blue', 'light blue',
    'red', 'burgundy', 'green', 'olive', 'beige', 'brown',
    'yellow', 'orange', 'pink', 'purple', 'multicolor'
);

CREATE TYPE clothing_fit AS ENUM ('slim', 'regular', 'relaxed', 'oversized');

CREATE TYPE clothing_season AS ENUM ('all', 'spring_summer', 'autumn_winter', 'winter');

ALTER TABLE wardrobe_items
    ALTER COLUMN category TYPE clothing_category USING category::clothing_category,
    ALTER COLUMN sub_type  TYPE clothing_sub_type  USING sub_type::clothing_sub_type,
    ALTER COLUMN color     TYPE clothing_color     USING color::clothing_color,
    ALTER COLUMN fit       TYPE clothing_fit       USING fit::clothing_fit,
    ALTER COLUMN season    TYPE clothing_season    USING season::clothing_season;

ALTER TABLE wardrobe_items
    ALTER COLUMN fit    SET DEFAULT 'regular',
    ALTER COLUMN season SET DEFAULT 'all';
