-- Three order_cycles columns the code has always declared (lib/db/schema.ts)
-- that no earlier migration created: the first installations got them from a
-- schema push, a new one built from the migrations alone did not have them and
-- its home page failed. test/int/fresh-install.int.test.ts now compares the
-- whole schema with a migrated empty database.
--
-- A no-op where the columns exist (every running installation). Additive,
-- idempotent.

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS pickup_2_date timestamptz;
--> statement-breakpoint
ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS pickup_2_end_time text;
--> statement-breakpoint
ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS shipping_cost_per_member numeric(10, 2);
