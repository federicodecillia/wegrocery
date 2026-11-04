-- "Avvisami quando apre" on a planned cycle (/calendario): who asked to be
-- told by email when its orders open. adminOpenPlannedCycle sends the email
-- (on top of the usual in-app cycle_opened notice, and only to those whose
-- email channel for it is off, so nobody gets two) and deletes the rows.
--
-- cycle_open_alerts.cycle_id    the planned cycle; its alerts go with it.
-- cycle_open_alerts.member_id   the person who asked (session personId, so a
--                               family member is told at their own address).
-- cycle_open_alerts.created_at  when they asked.
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: /calendario reads the table). Additive, safe for
--           the code already running. Idempotent.
-- Rollback: drizzle/0049_cycle_open_alerts_down.sql.

CREATE TABLE IF NOT EXISTS cycle_open_alerts (
  cycle_id text NOT NULL REFERENCES order_cycles(cycle_id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle_id, member_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cycle_open_alerts_member_idx ON cycle_open_alerts (member_id);
