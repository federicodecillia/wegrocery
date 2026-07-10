-- Per-member notification channel preferences (feature: preferenze notifiche).
-- Sparse table: an absent (member_id, category) row means "use the default
-- from lib/notifications/categories.ts". Nothing is back-filled for existing
-- members — the defaults live in code, so this migration is purely additive
-- and safe to apply on a live DB.
--
-- Apply with `npm run db:push` (local/demo) or by running this file directly
-- against the production Neon DB (see CLAUDE.md → "Production database
-- access"). No pre-flight check needed: the table is new.

CREATE TABLE IF NOT EXISTS notification_preferences (
  member_id     text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  category      text NOT NULL,
  app_enabled   boolean NOT NULL,
  email_enabled boolean NOT NULL,
  updated_at    timestamp with time zone NOT NULL,
  PRIMARY KEY (member_id, category)
);
