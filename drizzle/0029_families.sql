-- Families: two or more members sharing one account (cart, balance, history).
--
-- members.household_of   on a person who joined another member's account:
--                        that account. auth() resolves the person's address
--                        as usual, then serves the account it points to, so
--                        orders, drafts, movements and the balance are the
--                        account's. The person keeps their own addresses,
--                        name, role (for the admin panel) and card; their own
--                        balance is moved to zero when they join and stays
--                        there (nightly check household_member_empty). One
--                        level only: the account itself points nowhere.
-- app_settings.families_enabled   whether members can invite each other
--                        (admin -> Impostazioni). Off by default.
-- family_invites         an invitation to join an account, answered by the
--                        invited member (accept / decline), or withdrawn.
--
-- APPLY BEFORE DEPLOYING the code that ships with it: that code selects the
-- new columns. Additive, safe for the code already running. Idempotent.

ALTER TABLE members ADD COLUMN IF NOT EXISTS household_of text REFERENCES members(member_id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE members
  DROP CONSTRAINT IF EXISTS members_household_not_self,
  ADD CONSTRAINT members_household_not_self CHECK (household_of IS NULL OR household_of <> member_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS members_household_of_idx ON members (household_of) WHERE household_of IS NOT NULL;
--> statement-breakpoint
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS families_enabled boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS family_invites (
  invite_id text PRIMARY KEY,
  -- The account the invited member would join.
  account_id text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  -- The invited member.
  member_id text NOT NULL REFERENCES members(member_id) ON DELETE CASCADE,
  -- Address of whoever sent it (one of the account's people).
  invited_by text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  CONSTRAINT family_invites_status_check CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  CONSTRAINT family_invites_not_self CHECK (account_id <> member_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS family_invites_pending_uniq
  ON family_invites (account_id, member_id) WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS family_invites_member_idx ON family_invites (member_id) WHERE status = 'pending';
