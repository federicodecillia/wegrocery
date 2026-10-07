-- Welcome card: the first visit's short tour at the top of Home
-- (components/home/welcome-card.tsx). A personal flag, on the person who
-- signed in (not the family account they shop on).
--
-- members.welcome_dismissed_at   when the person closed the card. NULL = the
--                                card shows on Home. The guide's "Rivedi il
--                                benvenuto" shows it again without touching it.
--
-- Members who already used the app (an order or a ledger movement, theirs or,
-- for a person in a family, the account's) are marked as dismissed: the card
-- is for newcomers.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code selects the
-- new column. Additive, safe for the code already running. Idempotent: a
-- rerun only marks people who have used the app since, which is harmless.

ALTER TABLE members ADD COLUMN IF NOT EXISTS welcome_dismissed_at timestamptz;
--> statement-breakpoint
UPDATE members m
SET welcome_dismissed_at = now()
WHERE m.welcome_dismissed_at IS NULL
  AND (
    EXISTS (SELECT 1 FROM orders o WHERE o.member_id IN (m.member_id, m.household_of))
    OR EXISTS (SELECT 1 FROM ledger_entries l WHERE l.member_id IN (m.member_id, m.household_of))
  );
