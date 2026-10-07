-- Il nostro gruppo: a text the admins write in Impostazioni (where and when
-- to collect, who to ask, the group's own rules), shown at the top of the
-- member guide (/guida). The generic help lives in the code; what is local
-- to one group lives here.
--
-- app_settings.group_info   plain text, paragraphs split by a blank line,
--                           **bold**, links and addresses made clickable by
--                           the app. NULL = nothing to show. At most 2000
--                           characters.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code selects the
-- new column. Additive, safe for the code already running. Idempotent.

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS group_info text;
--> statement-breakpoint
ALTER TABLE app_settings
  DROP CONSTRAINT IF EXISTS app_settings_group_info_length,
  ADD CONSTRAINT app_settings_group_info_length CHECK (char_length(group_info) <= 2000);
