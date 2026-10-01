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
   Or set `MIGRATE_ON_BUILD=true` on the production environment of your
   Vercel project: every production build applies them first, and a failing
   migration stops the deploy.
3. Add any new environment variable and any new Stripe webhook event listed
   below.
4. Deploy, then open `/api/health`: it answers `ok: true` with the version.

Every migration is additive and can run twice without harm.

## Per version

| Version | Migration | Environment | Stripe webhook events |
|---|---|---|---|
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
