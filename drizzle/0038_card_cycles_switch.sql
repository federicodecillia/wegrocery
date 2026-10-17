-- Card cycles switch: a wallet group may keep card-paid cycles off while it
-- has not decided to take card payments, even with a working Stripe key
-- (online top-ups and refunds keep using the key).
--
-- app_settings.card_cycles_enabled   whether "Nuovo ciclo" offers Carta in a
--                        wallet group (lib/payments/cycle-mode.ts). On by
--                        default: groups that never touch it keep today's
--                        behaviour. Card cycles already created are not
--                        affected.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: that code selects the new column). Additive, safe
--           for the code already running. Idempotent.
-- Rollback: drizzle/0038_card_cycles_switch_down.sql (drops the column; Carta
--           is then offered again whenever the key works).

ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS card_cycles_enabled boolean NOT NULL DEFAULT true;
