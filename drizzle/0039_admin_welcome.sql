-- Admin welcome card: when the person closed the short tour at the top of
-- Admin (components/admin/admin-welcome-card.tsx). Personal, like
-- welcome_dismissed_at for the members' card on Home.
--
-- members.admin_welcome_dismissed_at   NULL = the card shows to this person
--                                      when they are an admin and the group's
--                                      first-run setup is finished.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0039_admin_welcome_down.sql (drops the column; every admin
--           then sees the card again).

ALTER TABLE members ADD COLUMN IF NOT EXISTS admin_welcome_dismissed_at timestamptz;
