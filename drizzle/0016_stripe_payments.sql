-- Online top-ups through Stripe Checkout.
--
-- payments                   one row per Checkout Session a member starts.
--   status                   pending -> succeeded | failed | expired;
--                            succeeded -> partially_refunded | refunded.
--                            Every transition is a guarded UPDATE
--                            (WHERE status = ...), so a webhook delivered twice
--                            or out of order changes nothing the second time.
--   amount_cents             what the member pays and what gets credited.
--   refunded_cents           cumulative amount refunded from the Stripe
--                            Dashboard; each refund posts the delta.
-- ledger_entries.payment_id  links the credit (type 'topup') and any refund
--                            rows to their payment. The partial unique index
--                            is the backstop against crediting a payment twice.
--                            Rows with a payment_id are not editable from Cassa:
--                            the money moved on Stripe, so the fix is a refund
--                            there (or a separate correction).
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): schema.ts declares ledger_entries.payment_id and
-- `select().from(ledger_entries)` lists it explicitly, so the new code fails on
-- a database that lacks it. Additive only: the old code ignores it.
--
-- Apply with `npm run db:migrate` against each environment.

CREATE TABLE IF NOT EXISTS payments (
  payment_id text PRIMARY KEY,
  member_id text NOT NULL REFERENCES members(member_id),
  provider text NOT NULL,
  status text NOT NULL,
  amount_cents integer NOT NULL,
  currency text NOT NULL,
  refunded_cents integer NOT NULL DEFAULT 0,
  checkout_session_id text UNIQUE,
  payment_intent_id text UNIQUE,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT payments_status_check CHECK (
    status IN ('pending', 'succeeded', 'failed', 'expired', 'partially_refunded', 'refunded')
  ),
  CONSTRAINT payments_amount_positive CHECK (amount_cents > 0),
  CONSTRAINT payments_refund_range CHECK (refunded_cents >= 0 AND refunded_cents <= amount_cents)
);

CREATE INDEX IF NOT EXISTS payments_member_id_idx ON payments (member_id);

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS payment_id text REFERENCES payments(payment_id);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_payment_topup_uniq
  ON ledger_entries (payment_id)
  WHERE type = 'topup';
