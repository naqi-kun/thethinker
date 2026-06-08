-- Dev seed — populates the DB with a test user and wardrobe items.
-- Safe to run multiple times (truncates first).
--
-- Usage:
--   psql postgres://thethinker:thethinker@localhost:5433/thethinker -f backend/seeds/dev.sql
--
-- Login with:
--   email:    dev@thethinker.com
--   password: password123

BEGIN;

-- Clean slate (dev only — never run against production)
TRUNCATE wardrobe_items, user_preferences, users RESTART IDENTITY CASCADE;

-- Test user
INSERT INTO users (id, email, password_hash) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'dev@thethinker.com',
  crypt('password123', gen_salt('bf', 10))
);

-- Preferences
INSERT INTO user_preferences (user_id, styles, answers) VALUES (
  '00000000-0000-0000-0000-000000000001',
  ARRAY['casual', 'business_casual'],
  '{"climate": "temperate", "occasion": "work"}'
);

-- Wardrobe items — mix of categories, fits, and seasons
INSERT INTO wardrobe_items (user_id, category, sub_type, color, fit, season) VALUES
  -- Tops
  ('00000000-0000-0000-0000-000000000001', 'casual',  't-shirt', 'white',    'regular', 'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'shirt',   'light blue','regular', 'spring_summer'),
  ('00000000-0000-0000-0000-000000000001', 'formal',  'shirt',   'white',    'slim',    'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'sweater', 'beige',    'relaxed', 'autumn_winter'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'hoodie',  'grey',     'oversized','all'),

  -- Outerwear
  ('00000000-0000-0000-0000-000000000001', 'formal',  'blazer',  'navy blue','slim',    'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'jacket',  'black',    'regular', 'autumn_winter'),

  -- Bottoms
  ('00000000-0000-0000-0000-000000000001', 'casual',  'jeans',   'blue',     'slim',    'all'),
  ('00000000-0000-0000-0000-000000000001', 'formal',  'pants',   'black',    'slim',    'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'shorts',  'beige',    'regular', 'spring_summer'),

  -- Shoes
  ('00000000-0000-0000-0000-000000000001', 'casual',  'sneakers','white',    'regular', 'all'),
  ('00000000-0000-0000-0000-000000000001', 'formal',  'shoes',   'black',    'slim',    'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual',  'boots',   'brown',    'regular', 'autumn_winter');

COMMIT;
