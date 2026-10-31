-- The pickup register of a closed cycle (Admin -> Ciclo -> Ritiri,
-- lib/pickups.ts): who collected their order, when, and an optional note.
-- One row per member (the account that ordered) and cycle; no row = not
-- collected yet. Clearing a pickup deletes its row (the audit log keeps it).
--
-- cycle_pickups.picked_up_at  when the order was collected (the time it was
--                             marked, or one the admin typed)
-- cycle_pickups.collected_by  who collected it when not the member, free text
-- cycle_pickups.note          a note for the admins, never shown to the member
-- cycle_pickups.recorded_by   the email of whoever marked it
--
-- Apply:    node scripts/db-migrate.mjs (APPLY BEFORE DEPLOYING the code that
--           ships with it: Admin -> Ciclo and Storico read the table).
--           Additive, safe for the code already running. Idempotent.
-- Rollback: drizzle/0046_cycle_pickups_down.sql.

CREATE TABLE IF NOT EXISTS cycle_pickups (
  cycle_id text NOT NULL REFERENCES order_cycles(cycle_id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  picked_up_at timestamptz NOT NULL,
  collected_by text,
  note text,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cycle_id, member_id),
  CONSTRAINT cycle_pickups_collected_by_len CHECK (collected_by IS NULL OR char_length(collected_by) <= 120),
  CONSTRAINT cycle_pickups_note_len CHECK (note IS NULL OR char_length(note) <= 500)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS cycle_pickups_member_idx ON cycle_pickups (member_id);
