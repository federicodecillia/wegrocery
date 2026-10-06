# Security policy

WeGrocery handles members' personal data and money, so security reports are
taken seriously and handled before anything else.

## Supported versions

Only the latest release on `main` receives fixes. If you run your own
instance, upgrade to it (see [docs/upgrading.md](docs/upgrading.md)).

## Reporting a vulnerability

Please **do not** open a public issue, discussion or pull request.

Report it privately through GitHub:
[**Report a vulnerability**](https://github.com/federicodecillia/wegrocery/security/advisories/new)
(Security tab → Advisories). Include:

- what an attacker can do, and which role they need (none, member, admin);
- the steps to reproduce it, ideally on the public demo
  ([wegrocery-demo.vercel.app](https://wegrocery-demo.vercel.app), fake data);
- the affected version or commit.

Test only against the demo or your own installation. Do not test against a
group's production deployment, do not access other people's data, and do not
run load or denial-of-service tests.

## What to expect

- An acknowledgement within a few days.
- An assessment and, if confirmed, a fix released to every deployment, with
  credit in the advisory unless you prefer otherwise.
- Please keep the details private until the fix is released.
