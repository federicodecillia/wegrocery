-- Drops the dedup column left behind by the "cycle closing soon" reminder,
-- removed in v1.9.0. The column only ever held a compare-and-swap timestamp
-- used to stop the cron resending; nothing reads it any more and it carries no
-- history worth keeping.
--
-- Safe to apply late, or not at all: the app no longer declares the column, and
-- an extra column in the database is invisible to Drizzle. Nothing breaks if
-- this file runs a week after the deploy.
--
-- Apply with `npm run db:migrate` against each environment (dev, demo, prod).

ALTER TABLE order_cycles
  DROP COLUMN IF EXISTS closing_reminder_sent_at;
