-- Rollback of drizzle/0052_signup.sql: the requests are lost, the members
-- created from them stay (as ordinary members).

DROP TABLE IF EXISTS membership_requests;
--> statement-breakpoint
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_joined_via_check;
--> statement-breakpoint
ALTER TABLE members DROP COLUMN IF EXISTS joined_via;
--> statement-breakpoint
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_signup_role_check;
--> statement-breakpoint
ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_signup_mode_check;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS signup_prepaid;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS signup_role;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS signup_mode;
