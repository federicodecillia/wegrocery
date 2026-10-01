-- Pay-per-order, second part (release B2.3): settlement of a cycle and
-- members who pay outside the app.
--
-- order_cycles.settled_at  when the last settlement ("Chiudi i conti") ran on
--                          a pay-per-order cycle; NULL = not settled yet.
-- members.pays_offline     the member confirms orders without Stripe and is
--                          settled from Treasury, as in wallet mode (a service
--                          account, someone who pays cash). No effect in
--                          wallet mode.
--
-- APPLY BEFORE DEPLOYING the code that ships with it. Additive, idempotent.

ALTER TABLE order_cycles ADD COLUMN IF NOT EXISTS settled_at timestamptz;
--> statement-breakpoint
ALTER TABLE members ADD COLUMN IF NOT EXISTS pays_offline boolean NOT NULL DEFAULT false;
