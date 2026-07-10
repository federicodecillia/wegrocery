-- Dedup column for the "cycle closing soon" reminder (feature: preferenze
-- notifiche, phase C). The reminder cron claims a cycle by flipping this from
-- NULL to now() (compare-and-swap), so concurrent/repeat runs don't resend.
-- adminUpdateCycle resets it to NULL when the close deadline moves, re-arming
-- the reminder. Additive and safe to apply on a live DB.
--
-- Apply with `npm run db:push` (local/demo) or by running this file directly
-- against the production Neon DB (see CLAUDE.md → "Production database
-- access").

ALTER TABLE order_cycles
  ADD COLUMN IF NOT EXISTS closing_reminder_sent_at timestamp with time zone;
