-- The ledger becomes append-only: no movement's amount, type, member or date
-- ever changes, and no movement is deleted. A correction is a new row.
--
-- ledger_entries.reversed_by  on a movement that was cancelled: the entry_id
--                             of the 'reversal' row that cancels it. Set once
--                             (NULL -> value), the only change a row may get.
-- ledger_entries.reverses     on a 'reversal' row: the movement it cancels,
--                             with the opposite amount. Unique: a movement is
--                             reversed at most once.
-- ledger_entries.replaces     on a movement written to correct another (Cassa
--                             "edit", a recomputed shipping share): the one it
--                             replaces, which has been reversed.
--
-- The one-charge-per-member-and-cycle index now counts only rows still in
-- force (not reversed), so a shipping share can be reversed and posted again.
--
-- The trigger rejects UPDATE (except setting reversed_by once) and DELETE.
-- Maintenance that must delete rows (the integration tests' cleanup) sets
-- `wegrocery.ledger_maintenance = on` for its own transaction; TRUNCATE (the
-- demo's nightly reset) does not fire row triggers.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code writes the new
-- columns. The old code would fail on edits and deletes from Cassa and on a
-- shipping recompute (the trigger refuses them), so deploy right after.
-- Idempotent.

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS reversed_by text,
  ADD COLUMN IF NOT EXISTS reverses text,
  ADD COLUMN IF NOT EXISTS replaces text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_reverses_uniq ON ledger_entries (reverses) WHERE reverses IS NOT NULL;
--> statement-breakpoint
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_reversal_check,
  ADD CONSTRAINT ledger_entries_reversal_check CHECK ((type = 'reversal') = (reverses IS NOT NULL));
--> statement-breakpoint
DROP INDEX IF EXISTS ledger_entries_cycle_member_charge_uniq;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_cycle_member_charge_live_uniq
  ON ledger_entries (cycle_id, member_id, type)
  WHERE type IN ('order_charge', 'shipping_charge') AND reversed_by IS NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ledger_entries_append_only() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF current_setting('wegrocery.ledger_maintenance', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'ledger_entries is append-only: % cannot be deleted, reverse it instead', OLD.entry_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.reversed_by IS NULL AND NEW.reversed_by IS NOT NULL
     AND (to_jsonb(NEW) - 'reversed_by') = (to_jsonb(OLD) - 'reversed_by') THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'ledger_entries is append-only: % cannot be changed, reverse it instead', OLD.entry_id
    USING ERRCODE = 'restrict_violation';
END
$fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ledger_entries_append_only ON ledger_entries;
--> statement-breakpoint
CREATE TRIGGER ledger_entries_append_only
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION ledger_entries_append_only();
