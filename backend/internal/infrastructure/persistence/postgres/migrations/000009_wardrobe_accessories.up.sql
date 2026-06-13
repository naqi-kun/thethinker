-- Add accessory sub-types so accessories can be saved to the wardrobe.
-- Additive only; existing rows are untouched. Requires Postgres 12+ (ADD VALUE
-- inside a transaction block), which the Aspire Postgres image provides.
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'watch';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'bag';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'belt';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'hat';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'scarf';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'sunglasses';
ALTER TYPE clothing_sub_type ADD VALUE IF NOT EXISTS 'tie';
