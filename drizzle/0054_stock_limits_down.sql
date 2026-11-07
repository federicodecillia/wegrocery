-- Rollback of drizzle/0054_stock_limits.sql: every product is unlimited again.

DROP INDEX IF EXISTS payments_order_pending_cycle_idx;
--> statement-breakpoint
ALTER TABLE app_settings DROP COLUMN IF EXISTS stock_limits_enabled;
--> statement-breakpoint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_max_per_member_check;
--> statement-breakpoint
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_max_quantity_check;
--> statement-breakpoint
ALTER TABLE products DROP COLUMN IF EXISTS max_per_member;
--> statement-breakpoint
ALTER TABLE products DROP COLUMN IF EXISTS max_quantity;
