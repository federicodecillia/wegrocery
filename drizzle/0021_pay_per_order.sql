-- Pay-per-order, first part (release B2.2 of the payment modes): a member
-- confirms an order by paying it with Stripe.
--
-- order_cycles.payment_mode    the group's mode when the cycle was created,
--                              fixed for the cycle's life: it decides how the
--                              cycle is paid and closed even after the group
--                              changes mode. Existing cycles are 'wallet'.
-- order_cycles.handling_fee_*  the "handling and order preparation" share of a
--                              'per_order' cycle: a percentage of the products
--                              or a fixed amount. An estimate, settled later.
-- payments.kind                'topup' (every existing row), 'order' (the
--                              payment that confirms an order), 'balance'
--                              (paying an amount due, from B2.3).
-- payments.cycle_id            the cycle an 'order' payment belongs to.
-- payments.order_snapshot      what that payment charged for: the lines at the
--                              prices paid and the breakdown. The webhook
--                              writes the order from it.
-- ledger_entries               at most one credit per payment and cycle for
--                              'order_payment' and 'balance_payment'.
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): schema.ts declares the new columns and Drizzle
-- names every column in its inserts and selects. Additive only: the old code
-- ignores the new columns, and their defaults keep every existing row valid.
-- No pre-flight check.
--
-- Idempotent. Postgres has no ADD CONSTRAINT IF NOT EXISTS, so each constraint
-- is dropped and added in the same ALTER TABLE. The statement-breakpoint
-- markers keep scripts/db-migrate.mjs from splitting on the semicolons of
-- these comments.

ALTER TABLE order_cycles
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'wallet',
  ADD COLUMN IF NOT EXISTS handling_fee_type text,
  ADD COLUMN IF NOT EXISTS handling_fee_value numeric(10, 2);
--> statement-breakpoint
ALTER TABLE order_cycles
  DROP CONSTRAINT IF EXISTS order_cycles_payment_mode_check,
  ADD CONSTRAINT order_cycles_payment_mode_check CHECK (payment_mode IN ('wallet', 'per_order')),
  DROP CONSTRAINT IF EXISTS order_cycles_handling_fee_type_check,
  ADD CONSTRAINT order_cycles_handling_fee_type_check CHECK (handling_fee_type IN ('percent', 'fixed')),
  DROP CONSTRAINT IF EXISTS order_cycles_handling_fee_value_check,
  ADD CONSTRAINT order_cycles_handling_fee_value_check CHECK (
    handling_fee_value >= 0 AND handling_fee_value <> 'NaN'
    AND (handling_fee_type <> 'percent' OR handling_fee_value <= 100)
  ),
  DROP CONSTRAINT IF EXISTS order_cycles_per_order_fee_check,
  ADD CONSTRAINT order_cycles_per_order_fee_check CHECK (
    payment_mode <> 'per_order' OR (handling_fee_type IS NOT NULL AND handling_fee_value IS NOT NULL)
  );
--> statement-breakpoint
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'topup',
  ADD COLUMN IF NOT EXISTS cycle_id text REFERENCES order_cycles(cycle_id),
  ADD COLUMN IF NOT EXISTS order_snapshot jsonb;
--> statement-breakpoint
ALTER TABLE payments
  DROP CONSTRAINT IF EXISTS payments_kind_check,
  ADD CONSTRAINT payments_kind_check CHECK (kind IN ('topup', 'order', 'balance')),
  DROP CONSTRAINT IF EXISTS payments_order_complete_check,
  ADD CONSTRAINT payments_order_complete_check CHECK (
    kind <> 'order' OR (cycle_id IS NOT NULL AND order_snapshot IS NOT NULL)
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS payments_member_cycle_idx ON payments (member_id, cycle_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_cycle_credit_uniq
  ON ledger_entries (payment_id, coalesce(cycle_id, ''))
  WHERE type IN ('order_payment', 'balance_payment');
