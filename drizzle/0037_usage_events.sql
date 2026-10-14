-- Usage measured with our own minimal counters (FlyLabs Playbook 7.8), no
-- third-party analytics: one row per day and event name, a count, nothing
-- else. No member id, no text a member wrote, no amount; the demo records
-- nothing. The names are a fixed list in lib/usage/events.ts.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: the app writes to the table and tolerates a
--           missing one, but Admin → Statistiche reads it). Additive,
--           idempotent.
-- Rollback: drizzle/0037_usage_events_down.sql (drops the table).

CREATE TABLE IF NOT EXISTS usage_events (
  day date NOT NULL,
  name text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, name)
);
