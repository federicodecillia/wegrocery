-- Membership-card verification (WallyFor) for self-onboarding members.
--
-- members.membership_status      'valid' | 'invalid' | NULL (never checked)
-- members.membership_verified_at when the last check ran (NULL = never)
--
-- Written by the sign-in callback and by saveOrder (24h recheck) only when
-- WALLYFOR_API_KEY / WALLYFOR_MERCHANT_ID are set; other deployments leave
-- both columns NULL. Additive and nullable.
--
-- APPLY BEFORE DEPLOYING the code that ships with it, on every environment
-- (dev/staging, demo, prod): schema.ts declares the columns and
-- `select().from(members)` lists them explicitly, so the new code fails on a
-- database that lacks them. The old code ignores them, so applying early is
-- harmless.
--
-- BEFORE APPLYING, run the pre-flight (must return 0 rows):
--
--   -- Sign-in and auto-provisioning look members up by the lower-cased
--   -- email/alias. A row stored with different casing or stray spaces would
--   -- not match, and its owner would get a second, auto-created member row.
--   SELECT member_id, email, alias_email
--   FROM members
--   WHERE email <> lower(trim(email))
--      OR (alias_email IS NOT NULL AND alias_email <> lower(trim(alias_email)))
--      OR lower(trim(email)) IN (SELECT lower(trim(alias_email)) FROM members WHERE alias_email IS NOT NULL);
--
-- If it returns rows, fix those emails first (they are data to understand,
-- not rows to delete).
--
-- Apply with `npm run db:migrate` against each environment (dev/staging, demo, prod).

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS membership_status text,
  ADD COLUMN IF NOT EXISTS membership_verified_at timestamptz;
