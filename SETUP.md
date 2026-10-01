# Local development

How to run WeGrocery on your computer and contribute. To run it for a group,
follow [docs/self-hosting.md](docs/self-hosting.md) instead.

## Prerequisites

- Node.js 24 (CI uses it; anything from 20.6 runs)
- A Postgres database: a free [Neon](https://neon.tech) project, or a branch
  of one, works best (the app uses Neon's serverless driver)

## 1. Code and dependencies

```bash
git clone https://github.com/federicodecillia/wegrocery.git
cd wegrocery
npm install
```

## 2. Environment: `.env.local`

```bash
cp .env.example .env.local
```

Then fill in at least:

- `DATABASE_URL`: the connection string of your development database.
- `AUTH_SECRET`: `openssl rand -hex 32` (use a different one from any real
  deployment).
- `AUTH_DEV_LOGIN_EMAIL`: your address. In development it shows a button
  that signs you in as that member, with no email or Google needed.

Everything else is optional; `.env.example` explains each variable, and
`npm run doctor` prints what is set up and what is missing.

## 3. Database

```bash
npm run db:migrate     # applies drizzle/*.sql to DATABASE_URL
```

Then make yourself an admin, with the address of `AUTH_DEV_LOGIN_EMAIL`:
either set `BOOTSTRAP_ADMIN_EMAIL` to it (the first sign-in creates the
admin), or insert the row yourself:

```sql
INSERT INTO members (member_id, full_name, email, role, active, created_at, updated_at)
VALUES ('mem_dev_' || substring(md5(random()::text), 1, 8), 'Dev', 'you@example.org', 'admin', true, now(), now());
```

For a database full of plausible fake data, point `.env.demo.local` at a
separate database and run `npm run db:seed:demo`.

## 4. Run

```bash
npm run dev            # http://localhost:3000
```

Google sign-in, if you set it up, needs the redirect URI
`http://localhost:3000/api/auth/callback/google`, so keep port 3000.

## 5. Tests

```bash
npx tsc --noEmit && npx next lint && npx vitest run   # what CI runs on every PR
```

Integration tests (`*.int.test.ts`) run the real queries on a database with
fake data only, never a real group's:

```bash
INT_TEST_USE_DATABASE_URL=1 node --env-file=.env.demo.local node_modules/vitest/vitest.mjs run -c vitest.int.config.ts
```

CI also applies every migration to an empty database and runs
`test/int/fresh-install.int.test.ts` there: a new installation's first day.

## Conventions

[AGENTS.md](AGENTS.md) has the architecture, the conventions and what to
update with each kind of change (migrations, environment variables,
CHANGELOG). Keep PRs focused; `npm test && npm run build` must stay green.

## Demo mode

`DEMO_MODE=true` enables one-click demo logins and disables outbound email.
It is meant ONLY for the public demo deployment (its own Vercel project and
its own database). Never set it on a real group's project.
