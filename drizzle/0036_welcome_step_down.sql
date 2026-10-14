-- Rollback of 0036_welcome_step.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
ALTER TABLE members DROP COLUMN IF EXISTS welcome_step;
