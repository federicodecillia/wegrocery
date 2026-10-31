-- Rollback of 0046_cycle_pickups.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- reads the table, and delete the row from _migrations to apply it again.
-- The pickups recorded are lost; the audit log keeps who marked what.
DROP TABLE IF EXISTS cycle_pickups;
