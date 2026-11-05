-- Rollback of 0050_pickup_tentative.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- reads the column, and delete the row from _migrations to apply it again.
-- Every pickup then reads as confirmed.
ALTER TABLE order_cycles DROP COLUMN IF EXISTS pickup_tentative;
