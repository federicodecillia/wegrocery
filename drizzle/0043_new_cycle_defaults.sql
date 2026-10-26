-- Defaults of new cycles, apart from the group's payment mode: a wallet group
-- may start its new cycles paid by card while keeping the wallet, and each
-- payment mode has its own starting shipping and preparation fee
-- (lib/payments/new-cycle-defaults.ts). Cycles already created keep what they
-- were created with.
--
-- app_settings.new_cycle_payment_mode   'wallet' | 'per_order' preselected in
--                        "Nuovo ciclo"; NULL = the group's mode (as before).
-- app_settings.new_cycle_defaults       jsonb, per mode ("wallet",
--                        "per_order"): {"shipping": {"mode", "amount"},
--                        "fee": {"type", "value"}}; NULL = as before (the
--                        last fee of that mode, shipping empty).
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0043_new_cycle_defaults_down.sql (drops the columns; new
--           cycles then start from the group's mode and the last fee again).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS new_cycle_payment_mode text;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS new_cycle_defaults jsonb;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_new_cycle_payment_mode_check') THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_new_cycle_payment_mode_check
      CHECK (new_cycle_payment_mode IN ('wallet', 'per_order'));
  END IF;
END $$;
