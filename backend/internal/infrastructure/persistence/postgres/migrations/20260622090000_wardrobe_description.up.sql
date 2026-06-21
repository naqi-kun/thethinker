-- Faithful free-text description of each garment, produced by the scan
-- classifier alongside the structured enums. Carries nuance the fixed enums
-- lose (true shade, pattern, silhouette, style vibe) and feeds the AI
-- recommender. NOT NULL DEFAULT '' so existing rows and the dev seed keep
-- working; they read as empty until re-scanned or backfilled (KAN-150).
ALTER TABLE wardrobe_items ADD COLUMN description TEXT NOT NULL DEFAULT '';
