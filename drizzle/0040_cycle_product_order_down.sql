-- Rollback of 0040_cycle_product_order.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the columns, and delete the row from _migrations to apply it again.
ALTER TABLE order_cycles DROP CONSTRAINT IF EXISTS order_cycles_product_order_valid;
ALTER TABLE order_cycles DROP COLUMN IF EXISTS product_order_saved_at;
ALTER TABLE order_cycles DROP COLUMN IF EXISTS product_order;
