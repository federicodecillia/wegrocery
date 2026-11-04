-- Cycles "in programma": a cycle can be created before its orders open, so
-- members see it in the calendar (/calendario) with its dates and a preview
-- of its products, and cannot order yet (every order write checks
-- status = 'open'). An admin or a "Referente ordini" opens it with "Apri gli
-- ordini" (lib/actions/admin.ts adminOpenPlannedCycle).
--
-- order_cycles.status           'planned' joins 'open' | 'closed' | 'cancelled'
--                               (no CHECK on the column: nothing to change).
-- order_cycles.dates_tentative  the dates may still move ("Date indicative"
--                               in the calendar); false for every existing
--                               cycle, cleared when the orders open.
-- order_cycles_fee_frozen()     the fee is frozen once the cycle is no longer
--                               open OR PLANNED (0026 froze it outside 'open'
--                               only, which would lock a planned cycle's fee).
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: the cycle reads select the column). Additive, safe
--           for the code already running, which never writes 'planned'.
--           Idempotent.
-- Rollback: drizzle/0048_planned_cycles_down.sql.

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS dates_tentative boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION order_cycles_fee_frozen() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_setting('wegrocery.ledger_maintenance', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.status NOT IN ('open', 'planned')
     AND (NEW.handling_fee_type IS DISTINCT FROM OLD.handling_fee_type
          OR NEW.handling_fee_value IS DISTINCT FROM OLD.handling_fee_value) THEN
    RAISE EXCEPTION 'order cycle %: the handling fee cannot change once the cycle is closed', OLD.cycle_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END
$fn$;
