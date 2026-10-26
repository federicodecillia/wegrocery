-- Rollback of 0043_new_cycle_defaults.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the columns, and delete the row from _migrations to apply it again.
ALTER TABLE app_settings DROP COLUMN IF EXISTS new_cycle_defaults;
ALTER TABLE app_settings DROP COLUMN IF EXISTS new_cycle_payment_mode;
