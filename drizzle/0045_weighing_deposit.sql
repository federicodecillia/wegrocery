-- The weighing deposit of a card cycle: a percentage on the products a member
-- pays with the order, for the products priced by weight whose final cost
-- only the supplier sheet tells. "Chiudi i conti" gives back by card what the
-- weighing did not use (lib/payments/settlement.ts), and with the wallet in
-- card payments anything beyond it rides on the next payment.
--
-- order_cycles.weighing_deposit_pct  percent of the products, 0 < pct <= 25;
--                                    NULL = no deposit (every existing cycle).
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0045_weighing_deposit_down.sql.

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS weighing_deposit_pct numeric(5, 2);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_cycles_weighing_deposit_check') THEN
    ALTER TABLE order_cycles ADD CONSTRAINT order_cycles_weighing_deposit_check
      CHECK (weighing_deposit_pct IS NULL OR (weighing_deposit_pct > 0 AND weighing_deposit_pct <= 25 AND payment_mode = 'per_order'));
  END IF;
END $$;
