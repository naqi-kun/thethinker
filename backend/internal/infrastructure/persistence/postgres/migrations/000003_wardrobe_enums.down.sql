ALTER TABLE wardrobe_items
    ALTER COLUMN fit    DROP DEFAULT,
    ALTER COLUMN season DROP DEFAULT;

ALTER TABLE wardrobe_items
    ALTER COLUMN category TYPE TEXT USING category::TEXT,
    ALTER COLUMN sub_type  TYPE TEXT USING sub_type::TEXT,
    ALTER COLUMN color     TYPE TEXT USING color::TEXT,
    ALTER COLUMN fit       TYPE TEXT USING fit::TEXT,
    ALTER COLUMN season    TYPE TEXT USING season::TEXT;

ALTER TABLE wardrobe_items
    ALTER COLUMN fit    SET DEFAULT 'regular',
    ALTER COLUMN season SET DEFAULT 'all';

ALTER TABLE wardrobe_items
    ADD CONSTRAINT wardrobe_items_fit_check
        CHECK (fit IN ('slim','regular','relaxed','oversized')),
    ADD CONSTRAINT wardrobe_items_season_check
        CHECK (season IN ('all','spring_summer','autumn_winter','winter'));

DROP TYPE IF EXISTS clothing_category;
DROP TYPE IF EXISTS clothing_sub_type;
DROP TYPE IF EXISTS clothing_color;
DROP TYPE IF EXISTS clothing_fit;
DROP TYPE IF EXISTS clothing_season;
