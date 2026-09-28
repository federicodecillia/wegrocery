-- One order_charge and one shipping_charge per (cycle, member). Closing a
-- cycle now posts them in a single transaction together with the status
-- flip; this index is the DB-level backstop that rejects a second charge
-- from any path (a retried close, a future bug) instead of silently
-- double-charging a member. Corrections, topups and adjustments are not
-- affected: the index is partial.
--
-- Apply with `npm run db:migrate` (per environment: dev, then demo, then prod).
--
-- BEFORE APPLYING, check for existing rows that would violate it:
--
--   -- duplicate cycle charges (must return 0 rows):
--   SELECT cycle_id, member_id, type, count(*), sum(amount)
--   FROM ledger_entries
--   WHERE type IN ('order_charge', 'shipping_charge')
--   GROUP BY 1, 2, 3 HAVING count(*) > 1;
--
-- If it returns rows, the member was charged twice (most likely a close
-- retried after a mid-way failure, before the atomic close). Inspect each
-- case against the member's orders and fix it by hand with a compensating
-- entry or by merging the duplicates, never by deleting blindly.

CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_cycle_member_charge_uniq
  ON ledger_entries (cycle_id, member_id, type)
  WHERE type IN ('order_charge', 'shipping_charge');
