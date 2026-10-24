-- Name prompt: members whose name is still the start of their address (they
-- joined with an email link, so no profile gave a real one) are asked for
-- first and last name after signing in (lib/members/name.ts).
--
-- app_settings.member_name_prompt   'off' | 'optional' | 'required'. 'optional'
--                                   (the default) lets them answer later;
--                                   'required' shows the question before any
--                                   page; 'off' never asks.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0041_member_name_prompt_down.sql (drops the column; the
--           app then never asks).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS member_name_prompt text NOT NULL DEFAULT 'optional';
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'app_settings_member_name_prompt_check') THEN
    ALTER TABLE app_settings ADD CONSTRAINT app_settings_member_name_prompt_check
      CHECK (member_name_prompt IN ('off', 'optional', 'required'));
  END IF;
END $$;
