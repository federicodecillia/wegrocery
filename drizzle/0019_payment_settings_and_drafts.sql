-- Payment settings the admins choose in the app, and order drafts kept on the
-- server (release B1 of the payment modes).
--
-- app_settings              one row (id = 1), written only by
--                           adminUpdatePaymentSettings
--                           (lib/actions/admin-settings.ts). No row means the
--                           brand defaults: resolvePaymentSettings
--                           (lib/payments/settings.ts) falls back to
--                           brand.minBalance, brand.bankTransfer and Stripe on.
--   payment_mode            'wallet' | 'per_order'. Always 'wallet' until
--                           pay-per-order ships (B2).
--   min_balance             credit limit, <= 0; NULL = no limit.
--   max_balance             highest balance an online top-up may reach, >= 0;
--                           NULL = no limit.
--   bank_transfer_enabled   /ricarica shows bank_holder and bank_iban; only
--                           allowed when both are set.
--   online_payments_enabled Stripe top-ups; they also need a usable key on
--                           the deploy (resolveStripeKey).
--   The CHECKs mirror the rules of the admin form: in 'wallet' at least one
--   channel is on, in 'per_order' Stripe is on.
-- order_drafts              the member's unconfirmed edits to an open cycle's
--                           order, one row per (member, cycle), lines =
--                           [{"productId": "...", "quantity": n}]. saveOrder
--                           and the cycle close delete them in their batch; a
--                           deleted member or cycle takes its drafts along.
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): the new code reads app_settings on /ricarica,
-- /ordine and in saveOrder, and scripts/seed-demo.ts truncates both tables, so
-- demo must be migrated before merging to main. Additive only: the old code
-- ignores both tables. No pre-flight check: both tables are new.
--
-- Idempotent (IF NOT EXISTS everywhere). The statement-breakpoint markers keep
-- scripts/db-migrate.mjs from splitting the statements on the semicolons of
-- these comments.

CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY,
  payment_mode text NOT NULL DEFAULT 'wallet',
  min_balance numeric(10, 2),
  max_balance numeric(10, 2),
  bank_transfer_enabled boolean NOT NULL,
  bank_holder text,
  bank_iban text,
  online_payments_enabled boolean NOT NULL,
  updated_at timestamptz NOT NULL,
  updated_by text NOT NULL,
  CONSTRAINT app_settings_single_row CHECK (id = 1),
  CONSTRAINT app_settings_payment_mode_check CHECK (payment_mode IN ('wallet', 'per_order')),
  CONSTRAINT app_settings_min_balance_check CHECK (min_balance <= 0),
  CONSTRAINT app_settings_max_balance_check CHECK (max_balance >= 0 AND max_balance <> 'NaN'),
  CONSTRAINT app_settings_balance_range_check CHECK (min_balance <= max_balance),
  CONSTRAINT app_settings_bank_complete_check CHECK (
    NOT bank_transfer_enabled OR (bank_holder IS NOT NULL AND bank_iban IS NOT NULL)
  ),
  CONSTRAINT app_settings_wallet_channel_check CHECK (
    payment_mode <> 'wallet' OR bank_transfer_enabled OR online_payments_enabled
  ),
  CONSTRAINT app_settings_per_order_online_check CHECK (
    payment_mode <> 'per_order' OR online_payments_enabled
  )
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS order_drafts (
  member_id text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  cycle_id text NOT NULL REFERENCES order_cycles(cycle_id) ON DELETE CASCADE,
  lines jsonb NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (member_id, cycle_id),
  CONSTRAINT order_drafts_lines_array CHECK (jsonb_typeof(lines) = 'array')
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS order_drafts_cycle_id_idx ON order_drafts (cycle_id);
