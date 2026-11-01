-- Rollback of 0047_orders_referent.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
-- The referents become plain members again.
ALTER TABLE members DROP COLUMN IF EXISTS orders_referent;
