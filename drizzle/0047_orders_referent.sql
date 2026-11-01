-- "Referente ordini": a member who helps run the order cycles without being
-- an admin (lib/roles.ts appAccess, lib/auth/manager.ts). Two separate axes
-- from here on: members.role still says which cycles a member sees
-- (utenti / attivi / admin), this flag opens a limited Admin area (cycles in
-- the member's visibility, supplier and sheet, pickups, catalogue, members
-- read only). An admin already has everything: the flag means nothing there.
--
-- members.orders_referent  false by default (every existing member).
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: the session reads the column). Additive, safe for
--           the code already running. Idempotent.
-- Rollback: drizzle/0047_orders_referent_down.sql.

ALTER TABLE members ADD COLUMN IF NOT EXISTS orders_referent boolean NOT NULL DEFAULT false;
