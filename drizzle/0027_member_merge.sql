-- Merging two accounts of the same person (Admin -> Members -> Merge,
-- lib/members/merge-store.ts).
--
-- members.merged_into          on an account absorbed by another that could
--                              not be deleted (it keeps closed-cycle orders,
--                              movements or payments): the member it was
--                              merged into. The account is deactivated, its
--                              addresses freed, its balance moved to zero.
-- ledger_entries.counterpart   on a 'member_merge' row: the entry_id of the
--                              opposite row on the other member. The balance
--                              moves as a pair (- on the absorbed account,
--                              + on the one that stays); no row ever changes
--                              member, the ledger stays append-only.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code selects the
-- new members column. Additive, safe for the code already running. Idempotent.

ALTER TABLE members ADD COLUMN IF NOT EXISTS merged_into text REFERENCES members(member_id);
--> statement-breakpoint
ALTER TABLE ledger_entries ADD COLUMN IF NOT EXISTS counterpart text;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ledger_entries_counterpart_uniq
  ON ledger_entries (counterpart) WHERE counterpart IS NOT NULL;
--> statement-breakpoint
ALTER TABLE ledger_entries
  DROP CONSTRAINT IF EXISTS ledger_entries_counterpart_check,
  ADD CONSTRAINT ledger_entries_counterpart_check CHECK ((type = 'member_merge') = (counterpart IS NOT NULL));
