-- Rollback of drizzle/0053_public_page.sql: the page goes away with its text.

ALTER TABLE app_settings DROP CONSTRAINT IF EXISTS app_settings_public_intro_length;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS public_intro;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS public_page_indexable;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS public_products_preview;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS public_page_enabled;
