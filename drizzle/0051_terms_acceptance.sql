-- Terms and privacy acceptance: a group may ask whoever signs in to accept its
-- privacy notice and terms of service (brand.privacyUrl, brand.termsUrl, both
-- links to the group's own pages) before using the app (lib/members/terms.ts).
-- Orders and payments are refused on the server until then.
--
-- app_settings.terms_required          off for every group, i.e. as before.
-- app_settings.terms_version           what a member accepts: the moment an
--                                      admin last asked everyone (ISO text);
--                                      NULL until the first time.
-- members.terms_accepted_at            when this person accepted, and which
-- members.terms_accepted_version       version. On the person who signed in,
--                                      never on the family account.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0051_terms_acceptance_down.sql (drops the columns; the
--           acceptances recorded so far are lost, the audit log keeps them).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS terms_required boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS terms_version text;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN IF NOT EXISTS terms_accepted_at timestamptz;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN IF NOT EXISTS terms_accepted_version text;
