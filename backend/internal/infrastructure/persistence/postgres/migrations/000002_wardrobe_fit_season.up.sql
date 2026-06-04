ALTER TABLE wardrobe_items
  ADD COLUMN fit    TEXT NOT NULL DEFAULT 'regular'
                    CHECK (fit IN ('slim','regular','relaxed','oversized')),
  ADD COLUMN season TEXT NOT NULL DEFAULT 'all'
                    CHECK (season IN ('all','spring_summer','autumn_winter','winter'));
