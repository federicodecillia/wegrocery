-- How the money of a manual Cassa movement moved, and its bank reference.
--
-- ledger_entries.method        'bonifico' | 'contanti' | 'satispay' | 'altro'
--                              on manual top-ups and payouts (CHECK below,
--                              mirrored by MANUAL_PAYMENT_METHODS in
--                              lib/ledger.ts). NULL everywhere else: online
--                              Stripe top-ups and their refunds (recognised by
--                              payment_id), order/shipping charges,
--                              corrections, and the manual charges and
--                              membership fees that move no money.
-- ledger_entries.external_ref  the CRO/TRN the treasurer copies from the bank
--                              statement. The partial unique index compares
--                              upper(trim(external_ref)), so the same transfer
--                              cannot be recorded twice, whatever the case or
--                              the surrounding spaces. NULL = no reference;
--                              a blank string is rejected (the app stores
--                              NULL instead), so blanks can never collide.
--
-- Payouts, manual charges and membership fees are new values of the free-text
-- ledger_entries.type ('payout', 'manual_charge', 'membership_fee', stored
-- negative): no schema change is needed for them.
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): schema.ts declares both columns and
-- `select().from(ledger_entries)` lists them explicitly, so the new code fails
-- on a database that lacks them. Additive only: the old code ignores them.
--
-- Apply with `npm run db:migrate` against each environment. No pre-flight
-- check is needed: existing rows get NULL in both columns, which passes the
-- CHECKs and is excluded from the index. Idempotent: the columns and the index
-- use IF NOT EXISTS and each CHECK is guarded by a pg_constraint lookup (no
-- ADD CONSTRAINT IF NOT EXISTS in Postgres); the statement-breakpoint markers
-- keep scripts/db-migrate.mjs from splitting the DO blocks on their inner
-- semicolons.

ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS method text;
--> statement-breakpoint
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS external_ref text;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_method_check') THEN
    ALTER TABLE ledger_entries
      ADD CONSTRAINT ledger_entries_method_check CHECK (method IN ('bonifico', 'contanti', 'satispay', 'altro'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_entries_external_ref_not_blank') THEN
    ALTER TABLE ledger_entries
      ADD CONSTRAINT ledger_entries_external_ref_not_blank CHECK (trim(external_ref) <> '');
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_external_ref_uniq
  ON ledger_entries (upper(trim(external_ref)))
  WHERE external_ref IS NOT NULL;
