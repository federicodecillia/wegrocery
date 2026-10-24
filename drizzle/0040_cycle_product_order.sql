-- Product order of a cycle: alphabetical (the default, as before) or the
-- order an admin chose in Admin → Ciclo → Prodotti (lib/products/cycle-order.ts).
--
-- order_cycles.product_order            'alpha' | 'custom'. 'custom' shows the
--                                       products by products.sort_order (the
--                                       column exists since 0000, filled in
--                                       loading order until an admin reorders).
-- order_cycles.product_order_saved_at   when an admin last saved a custom
--                                       order. NULL = never: switching to
--                                       'custom' starts from the alphabetical
--                                       order instead of the loading order.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0040_cycle_product_order_down.sql (drops the columns;
--           every cycle is then alphabetical again).

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS product_order text NOT NULL DEFAULT 'alpha';
--> statement-breakpoint
ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS product_order_saved_at timestamptz;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_cycles_product_order_valid') THEN
    ALTER TABLE order_cycles
      ADD CONSTRAINT order_cycles_product_order_valid CHECK (product_order IN ('alpha', 'custom'));
  END IF;
END $$;
