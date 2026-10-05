-- Possible duplicate accounts (Admin -> Members, lib/members/duplicates.ts):
-- the pairs an admin marked "not the same person", so they are not proposed
-- again. One row per pair, member_a < member_b. A deleted member takes its
-- rows with it.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: Admin -> Members reads
-- the table. Additive, safe for the code already running. Idempotent.

CREATE TABLE IF NOT EXISTS member_duplicate_dismissals (
  member_a text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  member_b text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  dismissed_by text NOT NULL,
  dismissed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_a, member_b),
  CONSTRAINT member_duplicate_dismissals_order CHECK (member_a < member_b)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS member_duplicate_dismissals_b_idx ON member_duplicate_dismissals (member_b);
