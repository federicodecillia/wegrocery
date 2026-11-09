-- Limited quantities per cycle (lib/products/stock.ts): how many units of a
-- cycle's product can be sold, and how many one member may take. Off for
-- every group, i.e. as before: unlimited.
--
-- products.max_quantity             units for sale in the cycle, in the
--                                   product's order unit. NULL = unlimited.
-- products.max_per_member           units one member may order. NULL = no cap.
-- app_settings.stock_limits_enabled the two fields count only when on, read
--                                   inside the order guards themselves.
-- payments_order_pending_cycle_idx  the open card Checkouts of a cycle, whose
--                                   quantities stay reserved while they last.
--
-- What is left is always computed (max_quantity minus the orders and the
-- reservations of the other members, under the cycle's row lock): there is no
-- counter that could drift from the orders.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0054_stock_limits_down.sql (drops the columns and the index).

ALTER TABLE products ADD COLUMN IF NOT EXISTS max_quantity integer;
--> statement-breakpoint
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_per_member integer;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_max_quantity_check CHECK (max_quantity >= 0 AND max_quantity <= 99999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE products ADD CONSTRAINT products_max_per_member_check CHECK (max_per_member > 0 AND max_per_member <= 9999);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS stock_limits_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payments_order_pending_cycle_idx ON payments (cycle_id) WHERE kind = 'order' AND status = 'pending';
