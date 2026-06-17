-- Dev seed — populates the DB with a test user, wardrobe items, and outfit history.
-- Safe to run multiple times (truncates first).
-- NOTE: this SQL seed does not set image_url. For full seed with GCS images,
--       use the Aspire dashboard "Seed Dev Data" button or POST /dev/seed.
--
-- Usage:
--   docker exec -i <postgres-container> psql -U postgres -d thethinker < backend/seeds/dev.sql
--
-- Logins:
--   dev@thethinker.com  / password123
--   jane@thethinker.com / password123

BEGIN;

-- Clean slate (dev only — never run against production)
TRUNCATE outfit_history_items, outfit_history, wardrobe_items, user_preferences, users RESTART IDENTITY CASCADE;

-- Test users
INSERT INTO users (id, email, password_hash) VALUES
  ('00000000-0000-0000-0000-000000000001', 'dev@thethinker.com',
   crypt('password123', gen_salt('bf', 10))),
  ('00000000-0000-0000-0000-000000000002', 'jane@thethinker.com',
   crypt('password123', gen_salt('bf', 10)));

-- Preferences — distinct aesthetics + locations so the seed exercises the
-- aesthetic (KAN-92) and weather (KAN-114) signals. answers uses the current
-- {aesthetic, location} keys (legacy climate/occasion retired); styles empty to
-- match what onboarding/Settings now write.
INSERT INTO user_preferences (user_id, styles, answers) VALUES
  ('00000000-0000-0000-0000-000000000001',
   '{}',
   '{"aesthetic": "Streetwear", "location": "Berlin"}'),
  ('00000000-0000-0000-0000-000000000002',
   '{}',
   '{"aesthetic": "Old Money", "location": "Paris"}');

-- Wardrobe items — explicit UUIDs so outfit history can reference them
INSERT INTO wardrobe_items (id, user_id, category, sub_type, color, fit, season) VALUES
  -- Tops
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'casual', 't-shirt',    'white',     'regular',   'all'),
  ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'casual', 'shirt',      'light blue','regular',   'spring_summer'),
  ('a0000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'formal', 'shirt',      'white',     'slim',      'all'),
  ('a0000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'casual', 'sweater',    'beige',     'relaxed',   'autumn_winter'),
  ('a0000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'casual', 'hoodie',     'grey',      'oversized', 'all'),

  -- Outerwear
  ('a0000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'formal', 'blazer',     'navy blue', 'slim',      'all'),
  ('a0000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'casual', 'jacket',     'black',     'regular',   'autumn_winter'),

  -- Bottoms
  ('a0000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'casual', 'jeans',      'blue',      'slim',      'all'),
  ('a0000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'formal', 'pants',      'black',     'slim',      'all'),
  ('a0000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'casual', 'shorts',     'beige',     'regular',   'spring_summer'),

  -- Shoes
  ('a0000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'casual', 'sneakers',   'white',     'regular',   'all'),
  ('a0000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'formal', 'shoes',      'black',     'slim',      'all'),
  ('a0000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'casual', 'boots',      'brown',     'regular',   'autumn_winter');

-- Outfit history — 5 entries over the past 5 days, varying time of day and occasion
INSERT INTO outfit_history (id, user_id, session_id, occasion, worn_on, time_of_day, weather_snapshot, created_at) VALUES
  (
    'b0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'seed-session-1', 'casual',
    CURRENT_DATE - 1, 'morning',
    '{"temperature": 20, "feels_like": 19, "description": "sunny"}',
    NOW() - INTERVAL '1 day'
  ),
  (
    'b0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'seed-session-2', 'formal',
    CURRENT_DATE - 2, 'afternoon',
    '{"temperature": 18, "feels_like": 17, "description": "cloudy"}',
    NOW() - INTERVAL '2 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'seed-session-3', 'casual',
    CURRENT_DATE - 3, 'evening',
    '{"temperature": 15, "feels_like": 14, "description": "clear"}',
    NOW() - INTERVAL '3 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'seed-session-4', 'casual',
    CURRENT_DATE - 4, 'morning',
    '{"temperature": 22, "feels_like": 22, "description": "clear"}',
    NOW() - INTERVAL '4 days'
  ),
  (
    'b0000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'seed-session-5', 'formal',
    CURRENT_DATE - 5, 'afternoon',
    '{"temperature": 16, "feels_like": 15, "description": "overcast"}',
    NOW() - INTERVAL '5 days'
  );

-- Outfit history items — which wardrobe pieces were worn each day
INSERT INTO outfit_history_items (outfit_history_id, item_id, image_url, category, sub_type, color, fit, season) VALUES
  -- Day -1: casual morning (t-shirt + jeans + sneakers)
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', '', 'casual', 't-shirt',  'white', 'regular', 'all'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000008', '', 'casual', 'jeans',    'blue',  'slim',    'all'),
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000011', '', 'casual', 'sneakers', 'white', 'regular', 'all'),

  -- Day -2: formal afternoon (white shirt + blazer + black pants + black shoes)
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000003', '', 'formal', 'shirt',    'white',     'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000006', '', 'formal', 'blazer',   'navy blue', 'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000009', '', 'formal', 'pants',    'black',     'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000012', '', 'formal', 'shoes',    'black',     'slim', 'all'),

  -- Day -3: casual evening (hoodie + jeans + boots)
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000005', '', 'casual', 'hoodie', 'grey',  'oversized', 'all'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000008', '', 'casual', 'jeans',  'blue',  'slim',      'all'),
  ('b0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000013', '', 'casual', 'boots',  'brown', 'regular',   'autumn_winter'),

  -- Day -4: casual morning (light blue shirt + shorts + sneakers)
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000002', '', 'casual', 'shirt',    'light blue', 'regular', 'spring_summer'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000010', '', 'casual', 'shorts',   'beige',      'regular', 'spring_summer'),
  ('b0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000011', '', 'casual', 'sneakers', 'white',      'regular', 'all'),

  -- Day -5: formal afternoon (white shirt + blazer + black pants + black shoes)
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', '', 'formal', 'shirt',  'white',     'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000006', '', 'formal', 'blazer', 'navy blue', 'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000009', '', 'formal', 'pants',  'black',     'slim', 'all'),
  ('b0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000012', '', 'formal', 'shoes',  'black',     'slim', 'all');

COMMIT;
