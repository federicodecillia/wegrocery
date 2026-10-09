-- Bank transfer reference per order: the admins write a template in
-- Impostazioni (placeholders {ordine} {mese} {anno} {socio}, or {order}
-- {month} {year} {member}) and the address members send the transfer receipt
-- to. The app fills the template for every order paid by bank transfer
-- (lib/payments/bank-reference.ts).
--
-- app_settings.bank_reference_template  NULL = the app's generic template.
--                                       At most 140 characters (SEPA).
-- app_settings.bank_receipt_email       NULL = no receipt is asked for.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code selects the
-- new columns. Additive, safe for the code already running. Idempotent.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bank_reference_template text;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS bank_receipt_email text;
--> statement-breakpoint
ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_bank_reference_length,
  ADD CONSTRAINT app_settings_bank_reference_length CHECK (char_length(bank_reference_template) <= 140);
--> statement-breakpoint
ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_bank_receipt_email_length,
  ADD CONSTRAINT app_settings_bank_receipt_email_length CHECK (char_length(bank_receipt_email) <= 254);
