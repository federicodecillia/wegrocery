-- Wallet top-ups can be switched off: a wallet group that now collects every
-- order by card stops members from topping up by bank transfer or online
-- (lib/payments/settings.ts, resolvePaymentSettings). The wallet itself stays:
-- balances, debts and the ledger are untouched.
--
-- app_settings.wallet_topups_enabled   the group's switch, on by default:
--                                      groups that never touch it keep
--                                      today's behaviour.
-- app_settings_wallet_channel_check    a wallet group still needs a top-up
--                                      channel, unless top-ups are off.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive (the
--           CHECK only widens), safe for the code already running. Idempotent.
-- Rollback: drizzle/0044_wallet_topups_down.sql, only while every wallet
--           group has a top-up channel (bank transfer or online) turned on.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS wallet_topups_enabled boolean NOT NULL DEFAULT true;
--> statement-breakpoint
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_wallet_channel_check;
--> statement-breakpoint
ALTER TABLE app_settings ADD CONSTRAINT app_settings_wallet_channel_check CHECK (
  payment_mode <> 'wallet' OR NOT wallet_topups_enabled OR bank_transfer_enabled OR online_payments_enabled
);
