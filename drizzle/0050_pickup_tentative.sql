-- "Ritiro da confermare": the pickup date of a cycle is the expected one and
-- may still move until the supplier confirms it (often only after the close).
-- Members read "da confermare" next to it (Home, Ordine, Storico, calendar,
-- the .ics file); when an admin clears it, the members with an order get a
-- pickup_confirmed notification.
--
-- order_cycles.pickup_tentative  false for every cycle, i.e. as before.
--                                Opening a planned cycle with "Date
--                                indicative" sets it.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: the cycle reads select the column). Additive,
--           safe for the code already running. Idempotent.
-- Rollback: drizzle/0050_pickup_tentative_down.sql.

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS pickup_tentative boolean NOT NULL DEFAULT false;
