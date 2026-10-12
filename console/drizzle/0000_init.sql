-- WeGrocery Console registry: the installations the operator runs, their
-- health snapshots, the provisioning checklist, intake requests, login
-- attempts and the audit log. No member data of any group ever lands here;
-- the only stored secret is each instance's INSTANCE_STATS_SECRET, encrypted
-- with CONSOLE_ENCRYPTION_KEY (AES-256-GCM).
-- Idempotent: safe to run twice.

CREATE TABLE IF NOT EXISTS requests (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'created', 'discarded')),
  group_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  city text,
  members_estimate integer,
  locale text NOT NULL DEFAULT 'it',
  currency text NOT NULL DEFAULT 'EUR',
  time_zone text NOT NULL DEFAULT 'Europe/Rome',
  email_domain text,
  dns_manager text,
  logo_url text,
  colors text,
  online_payments boolean NOT NULL DEFAULT false,
  google_login boolean NOT NULL DEFAULT false,
  card_check boolean NOT NULL DEFAULT false,
  payment_mode text NOT NULL DEFAULT 'wallet' CHECK (payment_mode IN ('wallet', 'per_order')),
  hosting_preference text NOT NULL DEFAULT 'managed' CHECK (hosting_preference IN ('managed', 'group_owned')),
  notes text,
  privacy_accepted_at timestamptz NOT NULL,
  ip_hash text
);
CREATE INDEX IF NOT EXISTS requests_ip_created_idx ON requests (ip_hash, created_at);

CREATE TABLE IF NOT EXISTS instances (
  id text PRIMARY KEY,
  slug text NOT NULL,
  name text NOT NULL,
  url text NOT NULL,
  hosting_model text NOT NULL DEFAULT 'managed' CHECK (hosting_model IN ('managed', 'group_owned')),
  vercel_team_id text,
  vercel_team_slug text,
  vercel_project_id text,
  neon_org_id text,
  neon_project_id text,
  resend_domain_id text,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('provisioning', 'live', 'archived')),
  stats_secret_enc text,
  notes text,
  request_id text REFERENCES requests (id) ON DELETE SET NULL,
  rollout_order integer NOT NULL DEFAULT 100,
  wizard jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS instances_slug_idx ON instances (slug);

CREATE TABLE IF NOT EXISTS instance_snapshots (
  id bigserial PRIMARY KEY,
  instance_id text NOT NULL REFERENCES instances (id) ON DELETE CASCADE,
  taken_at timestamptz NOT NULL DEFAULT now(),
  health_ok boolean,
  health_version text,
  health_db boolean,
  stats jsonb,
  error text
);
CREATE INDEX IF NOT EXISTS instance_snapshots_instance_idx ON instance_snapshots (instance_id, taken_at DESC);

CREATE TABLE IF NOT EXISTS provisioning_steps (
  instance_id text NOT NULL REFERENCES instances (id) ON DELETE CASCADE,
  step text NOT NULL,
  status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'done', 'failed', 'skipped')),
  detail text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (instance_id, step)
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id bigserial PRIMARY KEY,
  ip_hash text NOT NULL,
  success boolean NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS login_attempts_ip_idx ON login_attempts (ip_hash, attempted_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  instance_id text,
  detail text
);
CREATE INDEX IF NOT EXISTS audit_log_at_idx ON audit_log (at DESC);
