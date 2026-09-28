-- Uniform role and cycle-access terminology: admin / attivi / utenti.
--
-- members.role               'admin' | 'attivi' | 'utenti'
-- order_cycles.access_level  'admin' | 'attivi' | 'utenti'  (the minimum role
--                            that can see and order in the cycle)
-- admin sees every cycle, attivi sees 'utenti' + 'attivi' cycles, utenti sees
-- only 'utenti' cycles (lib/roles.ts).
--
-- Legacy values rewritten here:
--   members.role               'socio' (labelled "Utente")         -> 'utenti'
--                              'attivo' (labelled "Socio"), 'member' -> 'attivi'
--   order_cycles.access_level  'all', 'utenti'                       -> 'utenti'
--                              'soci' ("Soci Attivi"), 'attivi', 'member' -> 'attivi'
-- Matching is case- and whitespace-insensitive, like normalizeRole.
-- There are no column defaults to update: both columns are NOT NULL without a
-- default and the app always writes an explicit value.
--
-- BEHAVIOUR CHANGE: the old code let a 'socio' ("Utente") member into 'soci'
-- ("Soci Attivi") cycles. From this release those members ('utenti') no
-- longer see nor get notified about 'attivi' cycles. The code already applies
-- this rule on legacy values, so the change happens at deploy, not here.
--
-- ORDER: DEPLOY THE CODE FIRST, then apply this migration. The new code reads
-- and writes both old and new values; the old code writes 'socio' / 'attivo'
-- / 'soci', which the CHECKs below reject (sign-in auto-provisioning and the
-- admin forms would fail). Apply per environment: dev/staging, demo, prod.
--
-- BEFORE APPLYING, run the pre-flight:
--
--   -- Every value must be one of the legacy or new ones listed above;
--   -- anything else makes the CHECK fail: fix it by hand first.
--   SELECT role, count(*) FROM members GROUP BY role;
--   SELECT access_level, count(*) FROM order_cycles GROUP BY 1;
--
--   -- Open cycles that become 'attivi' and the active members who lose
--   -- access to them (were 'socio'). Decide before the deploy whether each
--   -- cycle should instead be 'utenti' (standard, open to everyone):
--   SELECT cycle_id, title, access_level FROM order_cycles
--   WHERE status = 'open' AND lower(trim(access_level)) IN ('soci', 'attivi', 'member');
--   SELECT count(*) FROM members WHERE active AND lower(trim(role)) = 'socio';
--
-- ROLLBACK (only if the old code must run again): drop the two constraints
-- (ALTER TABLE ... DROP CONSTRAINT IF EXISTS members_role_valid /
-- order_cycles_access_level_valid) and map the values back
-- ('utenti' -> 'socio', 'attivi' -> 'attivo' for roles; 'attivi' -> 'soci'
-- for access levels; 'utenti' is already understood by the old code).
--
-- Idempotent: the UPDATEs only touch non-canonical rows and each CHECK is
-- wrapped in a DO block (Postgres has no ADD CONSTRAINT IF NOT EXISTS). The
-- statement-breakpoint markers keep scripts/db-migrate.mjs from splitting the
-- DO blocks on their inner semicolons.

UPDATE members SET role = 'utenti'
WHERE role <> 'utenti' AND lower(trim(role)) IN ('utenti', 'socio');
--> statement-breakpoint
UPDATE members SET role = 'attivi'
WHERE role <> 'attivi' AND lower(trim(role)) IN ('attivi', 'attivo', 'member');
--> statement-breakpoint
UPDATE members SET role = 'admin'
WHERE role <> 'admin' AND lower(trim(role)) = 'admin';
--> statement-breakpoint
UPDATE order_cycles SET access_level = 'utenti'
WHERE access_level <> 'utenti' AND lower(trim(access_level)) IN ('utenti', 'all');
--> statement-breakpoint
UPDATE order_cycles SET access_level = 'attivi'
WHERE access_level <> 'attivi' AND lower(trim(access_level)) IN ('attivi', 'soci', 'member');
--> statement-breakpoint
UPDATE order_cycles SET access_level = 'admin'
WHERE access_level <> 'admin' AND lower(trim(access_level)) = 'admin';
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'members_role_valid') THEN
    ALTER TABLE members
      ADD CONSTRAINT members_role_valid CHECK (role IN ('admin', 'attivi', 'utenti'));
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'order_cycles_access_level_valid') THEN
    ALTER TABLE order_cycles
      ADD CONSTRAINT order_cycles_access_level_valid CHECK (access_level IN ('admin', 'attivi', 'utenti'));
  END IF;
END $$;
