-- Welcome card: where the person stopped, kept in the database (FlyLabs
-- Playbook 4.4) instead of the browser tab, so the tour resumes on another
-- device and the "Riprendi" bar needs no sessionStorage.
--
-- members.welcome_step   the step the person left the card on (a key of
--                        lib/guide/welcome.ts), set when they move through the
--                        tour or follow one of its links, cleared when they
--                        close it. NULL = at the start. Personal, like
--                        welcome_dismissed_at.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0036_welcome_step_down.sql (drops the column; the tour then
--           starts at its first step again).

ALTER TABLE members ADD COLUMN IF NOT EXISTS welcome_step text;
