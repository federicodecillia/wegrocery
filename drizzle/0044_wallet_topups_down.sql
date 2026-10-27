-- Rollback of 0044_wallet_topups.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
-- Fails while a wallet group has top-ups off and no channel: turn bank
-- transfer or online payments on first.
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_wallet_channel_check;
ALTER TABLE app_settings ADD CONSTRAINT app_settings_wallet_channel_check CHECK (
  payment_mode <> 'wallet' OR bank_transfer_enabled OR online_payments_enabled
);
ALTER TABLE app_settings DROP COLUMN IF EXISTS wallet_topups_enabled;
