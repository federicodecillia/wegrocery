-- The group's own Stripe account, connected by an admin from Admin →
-- Impostazioni (or the first-run setup) instead of the hosting project's
-- environment variables. STRIPE_SECRET_KEY, when set, keeps priority: this
-- row is then ignored.
--
-- stripe_connection.secret_key_enc       the pasted secret or restricted key,
-- stripe_connection.webhook_secret_enc   and the signing secret of the webhook
--                                        endpoint the app created, both
--                                        AES-256-GCM sealed with a key derived
--                                        from AUTH_SECRET
--                                        (lib/payments/stripe-secret-box.ts):
--                                        rotating AUTH_SECRET makes them
--                                        unreadable and the admin reconnects.
-- stripe_connection.webhook_endpoint_id  Stripe's id of that endpoint (we_*),
--                                        deleted on disconnect.
-- stripe_connection.livemode             live or test key, checked against
--                                        the environment when read.
-- stripe_connection.account_label        the account's display name or id when
--                                        the key may read it; not a secret.
-- stripe_connection.connected_at / _by   when and by which admin.
--
-- One row at most (id = 1); no row = no in-app connection.
--
-- Additive: the code treats a missing table as "not connected", so it can be
-- applied before or after deploying. Idempotent.

CREATE TABLE IF NOT EXISTS stripe_connection (
  id integer PRIMARY KEY DEFAULT 1,
  secret_key_enc text NOT NULL,
  webhook_secret_enc text NOT NULL,
  webhook_endpoint_id text NOT NULL,
  livemode boolean NOT NULL,
  account_label text,
  connected_at timestamptz NOT NULL,
  connected_by text NOT NULL,
  CONSTRAINT stripe_connection_single_row CHECK (id = 1)
);
