DROP TABLE IF EXISTS outfit_history_items;
DROP TABLE IF EXISTS outfit_history;
DROP TYPE IF EXISTS time_of_day;
ALTER TABLE wardrobe_items DROP COLUMN IF EXISTS deleted_at;
