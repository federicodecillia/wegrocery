-- Rollback of 0041_member_name_prompt.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_member_name_prompt_check;
ALTER TABLE app_settings DROP COLUMN IF EXISTS member_name_prompt;
