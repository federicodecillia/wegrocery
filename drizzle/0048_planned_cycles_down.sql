-- Rollback of 0048_planned_cycles.sql. Never applied by scripts/db-migrate.mjs:
-- run it by hand (docs/upgrading.md) after deploying code that no longer
-- selects the column, and delete the row from _migrations to apply it again.
-- Planned cycles become cancelled (they have no orders), the flag goes, and
-- the fee freezes outside 'open' again as in 0026.
UPDATE order_cycles SET status = 'cancelled' WHERE status = 'planned';
--> statement-breakpoint
ALTER TABLE order_cycles DROP COLUMN IF EXISTS dates_tentative;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION order_cycles_fee_frozen() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_setting('wegrocery.ledger_maintenance', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.status <> 'open'
     AND (NEW.handling_fee_type IS DISTINCT FROM OLD.handling_fee_type
          OR NEW.handling_fee_value IS DISTINCT FROM OLD.handling_fee_value) THEN
    RAISE EXCEPTION 'order cycle %: the handling fee cannot change once the cycle is closed', OLD.cycle_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$fn$;
