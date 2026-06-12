-- Dev seed — populates the DB with test users and wardrobe items.
-- Safe to run multiple times (truncates first).
-- NOTE: this SQL seed does not set image_url. For full seed with GCS images,
--       use the Aspire dashboard "Seed Dev Data" button or POST /dev/seed.
--
-- Usage:
--   psql <DATABASE_URL> -f backend/seeds/dev.sql
--
-- Logins:
--   dev@thethinker.com  / password123
--   jane@thethinker.com / password123

BEGIN;

-- Clean slate (dev only — never run against production)
TRUNCATE wardrobe_items, user_preferences, users RESTART IDENTITY CASCADE;

-- Test users
INSERT INTO users (id, email, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001', 'dev@thethinker.com',
   crypt('password123', gen_salt('bf', 10))),
  ('00000000-0000-0000-0000-000000000002', 'jane@thethinker.com',
   crypt('password123', gen_salt('bf', 10)));

-- Preferences
INSERT INTO user_preferences (user_id, styles, answers) VALUES
  ('00000000-0000-0000-0000-000000000001',
   ARRAY['casual', 'business_casual'],
   '{"climate": "temperate", "occasion": "work"}'),
  ('00000000-0000-0000-0000-000000000002',
   ARRAY['formal', 'classic'],
   '{"climate": "temperate", "occasion": "formal"}');

-- Wardrobe items — user1 (casual / business)
INSERT INTO wardrobe_items (user_id, category, sub_type, color, fit, season) VALUES
  ('00000000-0000-0000-0000-000000000001', 'casual', 't-shirt',  'white',      'regular',   'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'shirt',    'light blue', 'regular',   'spring_summer'),
  ('00000000-0000-0000-0000-000000000001', 'formal', 'shirt',    'white',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'sweater',  'beige',      'relaxed',   'autumn_winter'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'hoodie',   'grey',       'oversized', 'all'),
  ('00000000-0000-0000-0000-000000000001', 'formal', 'blazer',   'navy blue',  'slim',      'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'jacket',   'black',      'regular',   'autumn_winter'),
  ('00000000-0000-0000-0000-000000000001', 'formal', 'coat',     'brown',      'regular',   'autumn_winter'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'jeans',    'blue',       'slim',      'all'),
  ('00000000-0000-0000-0000-000000000001', 'formal', 'pants',    'black',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'shorts',   'beige',      'regular',   'spring_summer'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'sneakers', 'white',      'regular',   'all'),
  ('00000000-0000-0000-0000-000000000001', 'formal', 'shoes',    'black',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000001', 'casual', 'boots',    'brown',      'regular',   'autumn_winter');

-- Wardrobe items — user2 (formal / smart)
INSERT INTO wardrobe_items (user_id, category, sub_type, color, fit, season) VALUES
  ('00000000-0000-0000-0000-000000000002', 'formal', 'suit',     'grey',       'slim',      'all'),
  ('00000000-0000-0000-0000-000000000002', 'formal', 'shirt',    'white',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000002', 'formal', 'blazer',   'black',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000002', 'formal', 'pants',    'grey',       'slim',      'all'),
  ('00000000-0000-0000-0000-000000000002', 'formal', 'shoes',    'black',      'slim',      'all'),
  ('00000000-0000-0000-0000-000000000002', 'casual', 'dress',    'navy blue',  'regular',   'spring_summer'),
  ('00000000-0000-0000-0000-000000000002', 'casual', 'skirt',    'beige',      'regular',   'spring_summer'),
  ('00000000-0000-0000-0000-000000000002', 'casual', 'sweater',  'white',      'relaxed',   'autumn_winter'),
  ('00000000-0000-0000-0000-000000000002', 'casual', 'sneakers', 'white',      'regular',   'all'),
  ('00000000-0000-0000-0000-000000000002', 'casual', 'boots',    'black',      'regular',   'autumn_winter');

COMMIT;
