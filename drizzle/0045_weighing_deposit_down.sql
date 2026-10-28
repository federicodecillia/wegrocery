-- Rollback of 0045_weighing_deposit.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
-- Deposits already paid stay in the ledger as order_payment rows.
ALTER TABLE order_cycles DROP CONSTRAINT IF EXISTS order_cycles_weighing_deposit_check;
ALTER TABLE order_cycles DROP COLUMN IF EXISTS weighing_deposit_pct;
