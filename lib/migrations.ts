// Every migration in drizzle/, in order: what a database must have applied.
// lib/config-status.test.ts checks it against the folder; add a line with
// each new migration.
export const MIGRATIONS = [
  "0000_tranquil_risque.sql",
  "0001_add_alias_email.sql",
  "0002_unit_pickup_catalog.sql",
  "0003_notifications.sql",
  "0004_proportional_shipping.sql",
  "0005_missing_indexes.sql",
  "0006_price_per_kg.sql",
  "0007_order_actuals.sql",
  "0008_unique_constraints.sql",
  "0009_notification_preferences.sql",
  "0010_cycle_reminder.sql",
  "0011_drop_cycle_reminder.sql",
  "0012_ledger_amount_checks.sql",
  "0013_unique_cycle_charges.sql",
  "0014_membership_verification.sql",
  "0015_role_terminology.sql",
  "0016_stripe_payments.sql",
  "0017_member_email_unique.sql",
  "0018_ledger_method_external_ref.sql",
  "0019_payment_settings_and_drafts.sql",
  "0020_stripe_refunds.sql",
  "0021_pay_per_order.sql",
  "0022_auth_sessions.sql",
  "0023_ledger_append_only.sql",
] as const;
