-- Rollback of 0038_card_cycles_switch.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
ALTER TABLE app_settings DROP COLUMN IF EXISTS card_cycles_enabled;
