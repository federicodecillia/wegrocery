-- Stripe refunds, one row each (release B2.1 of the payment modes).
--
-- refunds                   one row per refund of a payments row. Today the
--                           Stripe Dashboard starts them (reason 'dashboard');
--                           from B2.2 the app starts them too (cancelled
--                           order, late payment, settlement).
--   refund_id               'ref_<Stripe refund id>' for a refund first seen
--                           on Stripe, 'ref_legacy_<entry_id>' for the rows
--                           imported below; ids chosen by the app from B2.2
--                           are also its Stripe idempotency key.
--   status                  requested -> pending | succeeded | failed | canceled,
--                           pending -> succeeded | failed | canceled,
--                           succeeded -> failed | canceled. Only
--                           upsertStripeRefund (lib/payments/refund-store.ts)
--                           moves it, with guarded writes.
--   stripe_refund_id        NULL until Stripe names the refund: an app
--                           refund before Stripe answers, an imported row
--                           until an event mentions it again.
-- ledger_entries.refund_id  the refund a ledger row belongs to: its debit
--                           ('correction' for a top-up) and, when Stripe
--                           could not pay it, the 'refund_failed' credit that
--                           reverses it. Unique on (refund_id, type).
-- payments.refunded_cents   from now on the sum of the payment's refunds in
--                           'pending' or 'succeeded', moved in the same
--                           statement as the ledger row.
--
-- Legacy import: up to 1.14.1 each charge.refunded event posted the growth of
-- the charge's cumulative refunded amount as a negative 'correction' linked
-- to the payment. Each of those rows becomes a 'succeeded' refund with no
-- Stripe id (created_by 'import') and points at it. When Stripe mentions such
-- a refund again, upsertStripeRefund adopts the oldest imported row of the
-- same payment and amount instead of recording the refund twice.
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): schema.ts declares ledger_entries.refund_id and
-- `select().from(ledger_entries)` lists it. Additive only: the old code
-- ignores the new table and column. A Dashboard refund made between this
-- migration and the deploy is posted by the old code without a refund row:
-- after the deploy, check that
--   SELECT count(*) FROM ledger_entries WHERE payment_id IS NOT NULL
--   AND type = 'correction' AND amount < 0 AND refund_id IS NULL
-- is 0, otherwise run the last two statements of this file again.
--
-- Idempotent (IF NOT EXISTS, ON CONFLICT DO NOTHING, refund_id IS NULL). The
-- statement-breakpoint markers keep scripts/db-migrate.mjs from splitting the
-- statements on the semicolons of these comments.

CREATE TABLE IF NOT EXISTS refunds (
  refund_id text PRIMARY KEY,
  payment_id text NOT NULL REFERENCES payments(payment_id),
  member_id text NOT NULL REFERENCES members(member_id),
  cycle_id text REFERENCES order_cycles(cycle_id),
  amount_cents integer NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  stripe_refund_id text UNIQUE,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT refunds_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT refunds_status_check CHECK (
    status IN ('requested', 'pending', 'succeeded', 'failed', 'canceled')
  ),
  CONSTRAINT refunds_reason_check CHECK (
    reason IN ('settlement', 'order_cancelled', 'late_payment', 'dashboard')
  )
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS refunds_payment_id_idx ON refunds (payment_id);
--> statement-breakpoint
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS refund_id text REFERENCES refunds(refund_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_refund_type_uniq
  ON ledger_entries (refund_id, type)
  WHERE refund_id IS NOT NULL;
--> statement-breakpoint
INSERT INTO refunds
  (refund_id, payment_id, member_id, cycle_id, amount_cents, status, reason,
   stripe_refund_id, created_by, created_at, updated_at)
SELECT 'ref_legacy_' || l.entry_id, l.payment_id, l.member_id, NULL,
       round(-l.amount * 100)::integer, 'succeeded', 'dashboard',
       NULL, 'import', l.created_at, now()
FROM ledger_entries l
WHERE l.payment_id IS NOT NULL
  AND l.type = 'correction'
  AND l.amount < 0
  AND l.refund_id IS NULL
ON CONFLICT (refund_id) DO NOTHING;
--> statement-breakpoint
UPDATE ledger_entries l
SET refund_id = 'ref_legacy_' || l.entry_id
WHERE l.payment_id IS NOT NULL
  AND l.type = 'correction'
  AND l.amount < 0
  AND l.refund_id IS NULL
  AND EXISTS (SELECT 1 FROM refunds r WHERE r.refund_id = 'ref_legacy_' || l.entry_id);
