-- Rollback of 0038_admin_welcome.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
ALTER TABLE members DROP COLUMN IF EXISTS admin_welcome_dismissed_at;
