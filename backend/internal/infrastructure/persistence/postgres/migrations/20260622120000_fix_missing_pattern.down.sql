-- Intentionally a no-op. This migration only *repairs* the pattern column on
-- databases that skipped 20260621000000_wardrobe_pattern (production was stamped
-- at 20260622090000 before that migration could run). The column's teardown is
-- owned by 20260621000000_wardrobe_pattern.down.sql; dropping it here as well
-- would double-drop and — because that down lacks IF EXISTS — error on a full
-- rollback. Leaving it in place also keeps the schema consistent with the
-- migration version on a single `down` step (version <= 20260621000000 implies
-- the column exists).
DO $$ BEGIN NULL; END $$;
