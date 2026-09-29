-- Case-insensitive uniqueness for member emails and aliases (the login keys).
--
-- Sign-in, the per-request session refresh and the member lookups match the
-- normalized login address (trimmed, lower-case: normalizeEmail in
-- lib/member-email.ts) against members.email OR members.alias_email. Until now
-- only the exact email was unique (members_email_unique, migration 0000): the
-- same address could sit on two members with different casing, or as two
-- members' aliases, and a login then resolved to whichever row came back first.
--
--   members_email_lower_uniq        one member per lower(email)
--   members_alias_email_lower_uniq  one member per lower(alias_email); partial,
--                                   members without an alias are not compared
--
-- An address that is one member's email and another member's alias cannot be
-- expressed as an index: adminUpsertMember rejects it, and every other clash,
-- with a message naming the member who holds the address, and maps a unique
-- violation from a concurrent save to the same message. members_email_unique
-- stays: the auto-provisioning insert uses it as its ON CONFLICT (email) target.
--
-- BEHAVIOUR CHANGE for admins: saving a member (Admin -> Soci) with an email or
-- secondary email that another member already uses, in either field and in any
-- casing, is now refused with a readable error instead of being stored.
--
-- Additive and idempotent (IF NOT EXISTS). The code that ships with it works
-- with or without the indexes, so apply it before or after the deploy, per
-- environment with `npm run db:migrate`: dev/staging, then demo, then prod.
--
-- BEFORE APPLYING, run the pre-flight (every query must return 0 rows):
--
--   -- 1. The same email on more than one member, ignoring case:
--   SELECT lower(email) AS email, array_agg(member_id ORDER BY created_at) AS member_ids
--   FROM members
--   GROUP BY 1 HAVING count(*) > 1;
--
--   -- 2. The same alias on more than one member, ignoring case:
--   SELECT lower(alias_email) AS alias_email, array_agg(member_id ORDER BY created_at) AS member_ids
--   FROM members
--   WHERE alias_email IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
--
--   -- 3. An address that is one member's email and another member's alias
--   --    (no index enforces it, but logins would resolve to either member):
--   SELECT lower(e.email) AS address, e.member_id AS email_of, a.member_id AS alias_of
--   FROM members e
--   JOIN members a ON lower(a.alias_email) = lower(e.email) AND a.member_id <> e.member_id;
--
--   -- 4. Addresses not stored trimmed and lower-case. Lookups compare the
--   --    normalized login address, so these members cannot sign in:
--   SELECT member_id, email, alias_email
--   FROM members
--   WHERE email <> lower(trim(email)) OR alias_email <> lower(trim(alias_email));
--
-- If 1-3 return rows, the same person was most likely registered twice (for
-- example once by hand and once by auto-provisioning). Decide with the admins
-- which member keeps the address and fix the other one (clear or change its
-- alias, or merge the two members' orders and ledger entries first); never
-- delete rows blindly. Fix 4 by rewriting the value to lower(trim(...)).
-- 1 and 2 make this migration fail; 3 and 4 do not, but they misroute or
-- block logins.

CREATE UNIQUE INDEX IF NOT EXISTS members_email_lower_uniq
  ON members (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS members_alias_email_lower_uniq
  ON members (lower(alias_email))
  WHERE alias_email IS NOT NULL;
