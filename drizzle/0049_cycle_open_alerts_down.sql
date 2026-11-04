-- Rollback of 0049_cycle_open_alerts.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- reads the table, and delete the row from _migrations to apply it again.
-- The pending "Avvisami quando apre" requests are lost.
DROP TABLE IF EXISTS cycle_open_alerts;
