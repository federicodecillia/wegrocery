-- Rollback of 0051_terms_acceptance.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the columns, and delete the row from _migrations to apply it again.
ALTER TABLE members DROP COLUMN IF EXISTS terms_accepted_version;
ALTER TABLE members DROP COLUMN IF EXISTS terms_accepted_at;
ALTER TABLE app_settings DROP COLUMN IF EXISTS terms_version;
ALTER TABLE app_settings DROP COLUMN IF EXISTS terms_required;
