-- Public page of the group (/gruppo, lib/public-page.ts): a shop window for
-- people who are not in yet. Off for every group, i.e. as before.
--
-- app_settings.public_page_enabled     /gruppo answers, and "/" without a
--                                      session leads there instead of /login.
-- app_settings.public_products_preview the products of the next cycle (name,
--                                      variant, price) are listed. Off.
-- app_settings.public_page_indexable   search engines may index it. Off
--                                      (noindex).
-- app_settings.public_intro            the presentation text, plain text with
--                                      line breaks, at most 2000 characters.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new columns). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0053_public_page_down.sql (drops the columns).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS public_page_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS public_products_preview boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS public_page_indexable boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS public_intro text;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE app_settings ADD CONSTRAINT app_settings_public_intro_length CHECK (char_length(public_intro) <= 2000);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
