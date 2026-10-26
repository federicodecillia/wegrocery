-- Rollback of 0042_card_settles_wallet.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the columns, and delete the row from _migrations to apply it again.
-- It fails while wallet_transfer rows exist (the narrower CHECK refuses
-- them): those rows are money and stay.
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_counterpart_check,
  ADD CONSTRAINT ledger_entries_counterpart_check CHECK ((type = 'member_merge') = (counterpart IS NOT NULL));
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_balance_cents_check;
ALTER TABLE payments DROP COLUMN IF EXISTS balance_cents;
ALTER TABLE app_settings DROP COLUMN IF EXISTS card_settles_wallet;
