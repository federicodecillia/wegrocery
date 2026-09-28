-- Reject NaN money values at the DB level. Postgres `numeric` accepts 'NaN',
-- and before this fix an empty amount in the Cassa editor was written as NaN,
-- which made the member's balance (SUM of ledger_entries.amount) NaN forever.
-- The app now rejects non-finite amounts; these CHECKs are the backstop.
-- orders.unit_price_snapshot is the per-line price column (there is no
-- orders.unit_price); actual_line_total is NULL unless a line was re-weighed,
-- and a NULL passes the CHECK. products.unit_price is covered transitively:
-- a NaN there can only reach the ledger through an order line.
--
-- Apply with `npm run db:migrate` (per environment: dev, then demo, then prod).
--
-- BEFORE APPLYING, check for existing rows that would violate them:
--
--   -- NaN ledger amounts (must return 0 rows):
--   SELECT entry_id, member_id, type, cycle_id FROM ledger_entries WHERE amount = 'NaN';
--
--   -- NaN order money (must return 0 rows):
--   SELECT order_line_id, member_id, cycle_id FROM orders
--   WHERE line_total = 'NaN' OR unit_price_snapshot = 'NaN' OR actual_line_total = 'NaN';
--
-- If either returns rows, fix them by hand first (reconstruct the intended
-- amount from audit_log, action 'update_ledger'), never by deleting blindly.
--
-- Postgres has no ADD CONSTRAINT IF NOT EXISTS, so each CHECK is wrapped in a
-- DO block to stay idempotent. The statement-breakpoint markers keep
-- scripts/db-migrate.mjs from splitting the DO blocks on their inner semicolons.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_amount_not_nan') THEN
    ALTER TABLE ledger_entries
      ADD CONSTRAINT ledger_entries_amount_not_nan CHECK (amount <> 'NaN');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_line_total_not_nan') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_line_total_not_nan CHECK (line_total <> 'NaN');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_unit_price_snapshot_not_nan') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_unit_price_snapshot_not_nan CHECK (unit_price_snapshot <> 'NaN');
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_actual_line_total_not_nan') THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_actual_line_total_not_nan CHECK (actual_line_total <> 'NaN');
  END IF;
END $$;
