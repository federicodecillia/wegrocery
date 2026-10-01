-- Lotto B3: the order preparation fee becomes a charge of its own,
-- handling_charge, written at the close next to order_charge and
-- shipping_charge.
--
-- 1. One live charge of each kind per member and cycle: the index of 0023,
--    widened to the new type. Built before the old one is dropped, so the
--    guard is never missing.
-- 2. The fee of a cycle is what its members were charged with: once the cycle
--    is no longer open it cannot change. The app writes it only with
--    `WHERE status = 'open'` (lib/cycle-close-store.ts); this trigger is the
--    last line, with the maintenance switch of 0023.
--
-- Safe before the deploy: the 1.18.0 code never writes handling_charge and
-- changes the fee only on open cycles. Idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_cycle_member_system_charge_live_uniq
  ON ledger_entries (cycle_id, member_id, type)
  WHERE type IN ('order_charge', 'shipping_charge', 'handling_charge') AND reversed_by IS NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS ledger_entries_cycle_member_charge_live_uniq;
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
--> statement-breakpoint
DROP TRIGGER IF EXISTS order_cycles_fee_frozen ON order_cycles;
--> statement-breakpoint
CREATE TRIGGER order_cycles_fee_frozen
  BEFORE UPDATE OF handling_fee_type, handling_fee_value ON order_cycles
  FOR EACH ROW EXECUTE FUNCTION order_cycles_fee_frozen();
