# Upgrading an installation

What to do when you move your WeGrocery deploy to a newer version. The app
itself tells you what is missing: admin → Impostazioni → *Configuration
status*, or `npm run doctor` from a checkout with your environment.

## The usual steps

1. Back up the database (Neon keeps a few hours of history; take a
   `pg_dump` if you want more).
2. Apply the pending migrations **before** the new code goes live: the code
   names every column of the tables it writes.
   ```bash
   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs --status
   DATABASE_URL="postgres://…" node scripts/db-migrate.mjs
   ```
   Or set `MIGRATE_ON_BUILD=true` on your Vercel project: every production
   build applies them first (preview builds never do), and a failing
   migration stops the deploy.
3. Add any new environment variable and any new Stripe webhook event listed
   below.
4. Deploy, then open `/api/health`: it answers `ok: true` with the version.

Every migration is additive and can run twice without harm. Each file runs in
one transaction with a lock timeout. If your own environment files name the
production database in `PRODUCTION_DB_HOST`, the script asks for `--allow-prod`
before touching it (builds with `MIGRATE_ON_BUILD` pass it themselves).

## Restricted database role (optional, recommended)

By default the app connects as the database owner, so a leaked `DATABASE_URL`
could drop tables. With a restricted role the app can read and write rows
(`SELECT`, `INSERT`, `UPDATE`, `DELETE`) but never change the schema, and the
ledger's append-only trigger cannot be dropped by it.

1. Back up, then create the role with the owner's address (Neon refuses a
   guessable password: use a random one of 24+ characters):
   ```bash
   DATABASE_URL="<owner address>" APP_ROLE_PASSWORD="$(openssl rand -base64 24)" \
     node scripts/create-app-role.mjs        # --role app_rw by default, --allow-prod when asked
   ```
   Keep the password: the script never prints it. Running it again resets the
   password and re-grants tables created since (new tables are covered by
   default privileges for later owner migrations too).
2. On the Vercel project, set `DATABASE_URL` to the same address with the role
   name and its password (user `app_rw`), and add `DATABASE_MIGRATION_URL` with
   the owner's address. `scripts/db-migrate.mjs` uses `DATABASE_MIGRATION_URL`
   when set, so migrations keep working. Redeploy and open `/api/health`.
3. Admin → Impostazioni → *Configuration status* shows "Database access with a
   restricted role" as OK.

`MIGRATE_ON_BUILD` runs inside the Vercel build, so with it the owner's address
must be in the project environment too: for the full benefit run the migrations
from your machine or CI instead and leave the variable off.

Way back: put the owner's address in `DATABASE_URL` again and redeploy; then
revoke the role (`appRoleRevokeStatements` in `scripts/db-migrate-lib.mjs` lists
the statements; on Neon the owner cannot `DROP OWNED BY`, so privileges are
revoked one by one before `DROP ROLE`). `test/int/app-role.int.test.ts` checks
the role end to end, and the whole integration suite passes with it.

## Per version

| Version | Migration | Environment | Stripe webhook events |
|---|---|---|---|
| Unreleased | `0036_welcome_step.sql` (additive: `members.welcome_step`; apply it before deploying, the code selects the column; rollback in `0036_welcome_step_down.sql`) | `DATABASE_MIGRATION_URL` (optional: the owner's address for `scripts/db-migrate.mjs` while `DATABASE_URL` is a restricted role) | none |
| 1.25.0 | `0030_group_info.sql` (additive: `app_settings.group_info`), `0031_welcome.sql` (additive: `members.welcome_dismissed_at`, set for members who already ordered), `0032_guide_search_misses.sql` (additive: table `guide_search_misses`); apply them before deploying | none | none |
| 1.27.0 | `0034_group_identity.sql` (additive: table `group_identity`, marked as set up where members exist); apply it before deploying. `0035_stripe_connection.sql` (additive: table `stripe_connection`, for a Stripe account connected from Admin → Impostazioni; the code treats a missing table as "not connected") | `INSTANCE_STATS_SECRET` (optional, at least 32 characters: opens `/api/instance-stats` to a fleet console); no new variable for the in-app Stripe connection, which is ignored while `STRIPE_SECRET_KEY` is set | none (an in-app connection creates its own endpoint) |
| 1.26.0 | `0033_bank_reference.sql` (additive: `app_settings.bank_reference_template`, `app_settings.bank_receipt_email`); apply it before deploying | none | none |
| 1.23.0 | `0028_member_duplicate_dismissals.sql` (additive: table `member_duplicate_dismissals`), `0029_families.sql` (additive: `members.household_of`, `app_settings.families_enabled`, table `family_invites`); apply them before deploying | none | none |
| 1.22.0 | `0027_member_merge.sql` (additive: `members.merged_into`, `ledger_entries.counterpart`; apply it before deploying) | none | none |
| 1.21.0 | none | none (the sign-in email now also carries a code; nothing to configure) | none |
| 1.20.0 | none | none (Node.js 20.19 or later, for Next.js 16) | none |
| 1.19.0 | `0025_schema_catch_up.sql` (three `order_cycles` columns; a no-op where they exist), `0026_handling_charge.sql` (apply it right before deploying when `MIGRATE_ON_BUILD` is off) | `BOOTSTRAP_ADMIN_EMAIL` (new installations only); `MIGRATE_ON_BUILD` now runs on production builds only | none |
| 1.18.0 | `0023_ledger_append_only.sql` (right before deploying), `0024_settlement.sql` | none | none |
| 1.17.0 | `0021_pay_per_order.sql`, `0022_auth_sessions.sql` | email (`RESEND_API_KEY`, `MAIL_FROM`) needed for the email link; Google now optional; everyone signs in again once | none |
| 1.16.1 | none | `SENTRY_DSN` (optional) | none |
| 1.16.0 | none | theme colours in `NEXT_PUBLIC_BRAND_JSON` must be hex | none |
| 1.15.0 | `0020_stripe_refunds.sql` | none | add `refund.created`, `refund.updated`, `refund.failed` |
| 1.14.0 | `0019_payment_settings_and_drafts.sql` | none | none |
| 1.13.0 | `0017_member_email_unique.sql`, `0018_ledger_method_external_ref.sql` | none | none |
| 1.12.0 | `0016_stripe_payments.sql` | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (optional) | `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded` |
| 1.11.0 | `0012` to `0015` | `WALLYFOR_API_KEY`, `WALLYFOR_MERCHANT_ID` (optional) | none |
| 1.9.0 | `0011_drop_cycle_reminder.sql` | none | none |
| 1.7.0 | `0010_cycle_reminder.sql` | none | none |

The full list of events the webhook needs is `REQUIRED_STRIPE_EVENTS` in
`lib/payments/config.ts`. Older versions: see the CHANGELOG.
