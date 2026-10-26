-- The wallet balance in card payments: with the switch on, a member's card
-- payment for a pay-per-order cycle also pays their wallet debt, or uses
-- their wallet credit first (lib/payments/order-payment.ts, orderPaymentAmount).
--
-- app_settings.card_settles_wallet   the group's switch, off by default:
--                                    groups that never touch it keep today's
--                                    behaviour.
-- payments.balance_cents             on an order payment: the part of the
--                                    amount that paid the wallet debt
--                                    (balance_payment rows, outside the
--                                    cycle); the rest is the order's
--                                    (order_payment). 0 for every other payment.
-- ledger_entries type 'wallet_transfer'  wallet credit moved onto a card
--                                    cycle (or back): a pair of rows, one
--                                    outside any cycle and one on the cycle,
--                                    pointing at each other through
--                                    counterpart, like 'member_merge'.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive (the
--           counterpart CHECK only widens), safe for the code already
--           running. Idempotent.
-- Rollback: drizzle/0042_card_settles_wallet_down.sql, only while no
--           wallet_transfer row and no order payment with a balance part exist.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS card_settles_wallet boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE payments ADD COLUMN IF NOT EXISTS balance_cents integer NOT NULL DEFAULT 0;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'payments_balance_cents_check') THEN
    ALTER TABLE payments ADD CONSTRAINT payments_balance_cents_check
      CHECK (balance_cents >= 0 AND (balance_cents = 0 OR (kind = 'order' AND balance_cents < amount_cents)));
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_counterpart_check,
  ADD CONSTRAINT ledger_entries_counterpart_check
    CHECK ((type IN ('member_merge', 'wallet_transfer')) = (counterpart IS NOT NULL));
