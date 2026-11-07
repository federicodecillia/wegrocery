-- Open sign-up: who may join the group without being added by an admin
-- (lib/membership/signup.ts). Off for every group, i.e. as before.
--
-- app_settings.signup_mode             'closed' (only members, as before),
--                                      'request' (a form on /aderisci, an
--                                      admin approves), 'open' (a confirmed
--                                      address joins at once).
-- app_settings.signup_role             the role a newcomer gets: 'attivi' or
--                                      'utenti', never 'admin'.
-- app_settings.signup_prepaid          newcomers never go below zero: each
--                                      order is paid when confirmed (card) or
--                                      from a balance already topped up. On by
--                                      default; off gives them the group's
--                                      credit limit like any member.
-- members.joined_via                   'request' | 'open' for a member who
--                                      joined this way; NULL for everyone
--                                      else (added by an admin, card check).
-- membership_requests                  the requests of 'request' mode. One
--                                      pending request per address (partial
--                                      unique index). ip_hash is an HMAC of
--                                      the address, never the address itself.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0052_signup_down.sql (drops the table and the columns;
--           the requests are lost, the members created stay).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS signup_mode text NOT NULL DEFAULT 'closed';
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS signup_role text NOT NULL DEFAULT 'utenti';
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS signup_prepaid boolean NOT NULL DEFAULT true;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE app_settings ADD CONSTRAINT app_settings_signup_mode_check CHECK (signup_mode IN ('closed', 'request', 'open'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE app_settings ADD CONSTRAINT app_settings_signup_role_check CHECK (signup_role IN ('attivi', 'utenti'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN IF NOT EXISTS joined_via text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE members ADD CONSTRAINT members_joined_via_check CHECK (joined_via IN ('request', 'open'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS membership_requests (
  request_id text PRIMARY KEY,
  email text NOT NULL,
  full_name text NOT NULL,
  phone text,
  note text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL,
  decided_at timestamptz,
  decided_by text,
  member_id text REFERENCES members(member_id) ON DELETE SET NULL,
  ip_hash text,
  terms_accepted_version text,
  CONSTRAINT membership_requests_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT membership_requests_email_length CHECK (char_length(email) <= 254),
  CONSTRAINT membership_requests_name_length CHECK (char_length(full_name) BETWEEN 1 AND 120),
  CONSTRAINT membership_requests_phone_length CHECK (char_length(phone) <= 40),
  CONSTRAINT membership_requests_note_length CHECK (char_length(note) <= 500)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS membership_requests_pending_email_uniq
  ON membership_requests (lower(email)) WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS membership_requests_status_created_idx ON membership_requests (status, created_at);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS membership_requests_ip_created_idx ON membership_requests (ip_hash, created_at);
