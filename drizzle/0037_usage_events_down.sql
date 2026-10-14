-- Rollback of 0037_usage_events.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) and delete the row from _migrations to
-- apply the migration again. The counters are lost.
DROP TABLE IF EXISTS usage_events;
