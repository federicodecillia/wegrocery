-- Per-line "actual delivered" values, for the case where the supplier weighed
-- a slightly different amount than what the member ordered (e.g. ordered 1 kg
-- of beetroot, got 800 g). The admin records the actual quantity and the
-- effective cost from the closed-cycle recap. The delta vs the original
-- line_total is posted as a `correction` ledger entry, same model as
-- `adminEditClosedOrder` (see migration 0003 / lib/actions/admin.ts).
--
-- Both columns are nullable: NULL means "delivered exactly as ordered".
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS actual_quantity numeric(10, 3),
  ADD COLUMN IF NOT EXISTS actual_line_total numeric(10, 2);
