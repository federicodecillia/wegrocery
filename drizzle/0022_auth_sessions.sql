-- Sign-in with an email link (Lotto C): the tables Better Auth needs, plus
-- when each member last signed in.
--
-- auth_users          one per sign-in identity (an email address), created on
--                     its first sign-in. The member is found by email or alias
--                     on every request (auth.ts), as with the previous JWTs.
-- auth_sessions       one per signed-in browser, 30 days.
-- auth_accounts       one per way in of an identity (Google, the email link).
-- auth_verifications  email-link tokens (stored hashed) and Better Auth's
--                     internal locks, hence a text id.
-- auth_rate_limits    request counters: 3 email-link requests a minute per IP,
--                     and caps on the emails one address receives (hashed keys).
-- members.last_login_at  set at every new session.
--
-- APPLY BEFORE DEPLOYING the code that ships with it. Additive only: the old
-- code ignores the new tables and column. Idempotent.

CREATE TABLE IF NOT EXISTS auth_users (
  id text PRIMARY KEY,
  email text NOT NULL,
  name text NOT NULL DEFAULT '',
  email_verified boolean NOT NULL DEFAULT false,
  image text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS auth_users_email_lower_uniq ON auth_users (lower(email));
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_sessions (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions (user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_accounts (
  id text PRIMARY KEY,
  user_id text NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  account_id text NOT NULL,
  provider_id text NOT NULL,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts (user_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_verifications (
  id text PRIMARY KEY,
  identifier text NOT NULL,
  value text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS auth_verifications_identifier_idx ON auth_verifications (identifier);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id text PRIMARY KEY,
  key text NOT NULL UNIQUE,
  count integer NOT NULL,
  last_request bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE members ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
