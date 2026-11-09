# Launch phase 2: a safe fleet

Status: ready to execute, written 2026-11-09 on top of 1.45.0. Each work package (WP) below is meant to be carried out as written, one PR to `staging` per WP (or per repository, where a WP spans two). Decisions still open are marked **[default]**: the default is what to build, unless the maintainer has said otherwise in `docs/status.md` or in the PR. Steps marked **Maintainer** need a person (a secret, a purchase, a DNS record, a production operation): stop there, open the PR with everything else done, and list the step in the PR description.

Phase 1 (released in 1.45.0) is in [2026-11-07-launch-phase1.md](./2026-11-07-launch-phase1.md).

## Why

A managed instance's fee promises backups, a nightly check of the money and updates. Today those exist only for the first production group: `.github/workflows/backup.yml` and its `invariants` job read one `DATABASE_URL` secret of this public repository, `restore-test.yml` restores that one database, and the Console's "Aggiorna flotta" only advances while its page is open in a browser. Before the first fee is charged, every managed instance needs the same protection, without the Console becoming a store of database credentials.

## Ground rules (all WPs)

- **The Console keeps no database credentials.** It holds only `INSTANCE_STATS_SECRET` per instance (sealed in `instances.stats_secret_enc`), which unlocks anonymous counts. That stays true after this phase.
- **This repository stays clean.** No list of customer instances, no per-customer secret. Anything per customer lives in the private repository of WP2 or in the Console's database.
- **Least privilege.** A job sees one instance at a time, with a read-only role.
- **The first production group goes last** in every round, and only after the maintainer's explicit ok for anything touching production.
- **No releases or rollouts on Saturday or Sunday.**
- **Money**: the ledger is append-only; every new money rule needs an invariant in `lib/invariants.ts`. This phase adds no money rule: everything here only reads.
- **How to work**, as in `AGENTS.md`:
  - one branch per WP from an up-to-date `origin/staging`, and a PR to `staging` (squash);
  - `npx tsc --noEmit && npm run lint && npm test` locally, plus the integration tests a WP adds;
  - user-visible text in `lib/i18n/` in it, en, es and fr;
  - an entry in `CHANGELOG.md` and `CHANGELOG.it.md`;
  - no em dash anywhere;
  - `docs/status.md` updated in the same PR.
- **Migrations** (app or Console) must be:
  - additive and idempotent (`IF NOT EXISTS`, `DO $$ ... EXCEPTION WHEN duplicate_object`);
  - shipped with a `_down.sql`;
  - written with `--> statement-breakpoint` between statements, in both files, because the integration tests send one statement per query;
  - for the app, registered in `lib/migrations.ts`.
- **Tests must not assume an `app_settings` row** (the CI database starts empty): insert or upsert it, as `test/int/stock.integration.test.ts` does.

## Order

| # | WP | Where | New secrets | Evenings |
|---|---|---|---|---|
| 0 | Move the code to `flylabs-ai` and the hosting to the Pro account | GitHub + Vercel, mostly operations | none | 1.5-2 |
| 1 | Nightly invariants for every instance | app + Console | none | 1 |
| 2 | Nightly backup and restore test for every instance | new private repo + app scripts + Console | one read-only URL per instance, an `age` key, `FLEET_REPORT_SECRET` | 2.5 |
| 3 | Full data export for the admin | app | none | 1.5 |
| 4 | Shared email sender with Reply-To | app + Console | none | 0.5-1 |
| 5 | `*.wegrocery.app` subdomains | Console | none | 0.5 |
| 6 | Fleet rollout without a browser, with a canary | Console | none | 2.5 |

WP0 comes first, by the maintainer's choice: everything after it is built in the new place. Then WP1 and WP2, which are the promise of the fee. WP6 needs a cron every few minutes, which only the Pro plan allows.

---

## WP0. Move the code to `flylabs-ai` and the hosting to the Pro account

The maintainer wants this first: the code moves from the personal GitHub account to the `flylabs-ai` organization, and the Vercel projects move from the current Hobby account (`federicos-projects-9705e949`, login `federico.decillia@portamoneta.org`) to the maintainer's Vercel account on the Pro plan, which allows commercial use. Every later WP is written for the new place: the Pro cron of WP6, the domain of WP5 and the private repository of WP2 all assume it.

Two parts, in this order, in the same week, on weekdays. Part A is GitHub, part B is Vercel. Between the GitHub transfer and the Vercel reconnection, pushes to `main` and `staging` do not deploy: merge nothing in that window.

### Part A. GitHub: `federicodecillia/*` to `flylabs-ai/*`

1. **Agent, before** (one PR to `staging`, merged and released before the transfer, so nothing breaks the day after):
   - `.github/workflows/release.yml` and `.github/workflows/ui-check.yml`: the guard `github.repository == 'federicodecillia/wegrocery'` becomes `github.repository_owner == 'flylabs-ai' || github.repository == 'federicodecillia/wegrocery'`, so the release keeps working on both sides of the transfer; the old name is removed in step 4;
   - `console/lib/env.ts`: default of `WEGROCERY_REPO` becomes `flylabs-ai/wegrocery`; same in `console/.env.example`;
   - links in `README.md`, `SETUP.md`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `docs/self-hosting.md` (also the "Deploy with Vercel" button URL), `console/README.md`, `.github/ISSUE_TEMPLATE/*`: `github.com/federicodecillia/wegrocery` becomes `github.com/flylabs-ai/wegrocery`. GitHub redirects the old URLs, so this can land before the transfer. Leave the maintainer's personal profile links (LinkedIn, GitHub profile) as they are, and leave old `CHANGELOG` entries as they are;
   - tests that use the name as sample data (`lib/brand/image-patterns.test.ts`, `console/lib/providers/providers.test.ts`) may stay: they test parsing, not the owner;
   - `AGENTS.md` and `docs/status.md`: the new names.
2. **Maintainer**, in this order:
   - make sure the `flylabs-ai` organization requires 2FA and that the maintainer is owner;
   - Settings, Transfer for `wegrocery`, then `wegrocery-example-brand`, to `flylabs-ai`. Names stay the same. GitHub keeps issues, PRs, releases, tags, Actions secrets and variables, environments, rulesets and webhooks, and redirects the old URLs and git remotes;
   - install on `flylabs-ai`, for these two repositories, the GitHub Apps that were on the personal account: Vercel (of the Pro account, see part B), Claude, and Codex's connector; re-enable Dependabot alerts and security updates, and Private vulnerability reporting, if they show as off;
   - in Claude (Project settings, repositories) and in Codex, replace the old repositories with the new ones.
3. **Agent, after**, verifies and reports:
   - the rulesets "main e staging" are still on (restrict deletions, block force pushes) and auto-delete of head branches is on;
   - the Actions secrets are still listed by name on both repositories (never read their values): `DATABASE_URL`, `NEON_API_KEY`, `RESTORE_TEST_NEON_API_KEY`, `VERCEL_PRODUCTION_DEPLOY_HOOK`, `VERCEL_DEPLOY_HOOK`, `VERCEL_AUTOMATION_BYPASS_SECRET` and the others named in the workflows;
   - one manual run each of `backup.yml`, `restore-test.yml` and the CI on a docs PR is green;
   - `git remote set-url origin https://github.com/flylabs-ai/<repo>.git` in every local clone, the vault notes and the example brand's `upstream` remote.
4. **Agent, cleanup PR**: remove the old name from the guards of step 1. In the vault and in this repository, no reference to `federicodecillia/wegrocery` is left except history (`CHANGELOG`, dated docs).

### Part B. Vercel: Hobby account to the Pro account

All transfers are done by the **Maintainer** (Vercel asks for the account owner). An agent prepares the checklist, then verifies after each step.

1. **Prepare**:
   - in the Pro account, install the Vercel GitHub app on the `flylabs-ai` organization with access to `wegrocery` and `wegrocery-example-brand`;
   - write an inventory per project (`porta-moneta`, `wegrocery-demo`, `wegrocery-example-brand`, `wegrocery-console`): env var **names** per environment, domains, deploy hooks, Ignored Build Step, Deployment Protection and "Protection Bypass for Automation", crons, integrations. It goes in the maintainer's private notes (the vault), never in this repository. Values are not copied: Vercel moves them with the project. Before starting, collect provider strings (Resend, Stripe, Google, Sentry) from the providers' dashboards in case one does not survive, because `AUTH_SECRET` cannot be recovered and changing it closes every session and requires reconnecting Stripe in the app.
2. **Neon integration decision first**: the old default of directly transferring Vercel-managed databases into one normal Neon organization is withdrawn: ordinary Neon organization transfer does not support that source. Use [the WP0 isolation and transfer-options proposal](./2026-11-09-neon-vercel-isolation-plan.md). It compares a supported Vercel-managed resource transfer with an independently validated database migration and separates customer data, Console and fake-data environments. Only planning is authorized; choose a method after the metadata-only inventory and explicit approval. Do not disconnect, install, provision, migrate, transfer or change billing from this plan alone.
3. **Trial on the example brand** (no real data): Settings, Transfer to the Pro account. Then reconnect Git to `flylabs-ai/wegrocery-example-brand` if Vercel asks, a production deploy from the GitHub source, `/api/health`, a sign-in, an email.
4. Then the **Console**, then the **demo**, then **`porta-moneta` last**, on a quiet weekday, after a manual Neon backup branch.
5. **After each transfer**:
   - Git connected to the `flylabs-ai` repository, production branch `main`, `vercel.json` rules unchanged (deploys only `main` and `staging`);
   - a production deploy from the GitHub source, and the `Deploy Health` workflow run for that commit is green;
   - for `porta-moneta`: the nightly invariants, a real sign-in, and a sandbox payment on staging (the Stripe sandbox endpoint points at the staging URL; check it still answers).
6. **Update**, then a docs PR:
   - the deploy hooks: run `deploy-production.yml` (wegrocery) and `deploy-hook.yml` (example brand) once; if a hook no longer answers, create a new one in the project and the maintainer puts its URL in `VERCEL_PRODUCTION_DEPLOY_HOOK` or `VERCEL_DEPLOY_HOOK`;
   - `VERCEL_AUTOMATION_BYPASS_SECRET`, if the bypass key changed;
   - the Console: `VERCEL_TOKEN` (a token of the Pro account, with expiry), and in its registry `vercel_team_id` and `vercel_team_slug` for every instance;
   - `AGENTS.md` (CLI scope, staging URL), `docs/status.md`, `docs/operating-two-environments.md`;
   - the cloud environment's allowed domains, if any `*.vercel.app` URL changed;
   - **Maintainer**: delete the empty projects in the old account only after a week without problems.

### Done when

The four projects deploy from `flylabs-ai/*` in the Pro account, the `Deploy Health` runs are green on all of them, the nightly backup, invariants and restore test of the first production group are green for two nights, and the release of the next version runs from `flylabs-ai/wegrocery` with its tag and GitHub release.

---

## WP1. Nightly invariants for every instance

### App: `GET /api/instance-invariants`

- New route `app/api/instance-invariants/route.ts`. It is a copy of the shape of `app/api/instance-stats/route.ts`:
  - `runtime = "nodejs"`, `dynamic = "force-dynamic"`;
  - same signature check: `verifiedContract` from `lib/instance-stats/signature.ts`, with `path: "/api/instance-invariants"` and the same `INSTANCE_STATS_SECRET`;
  - any refusal is a plain 404 with `Cache-Control: no-store`.
- Add `api/instance-invariants$` to the matcher exclusions in `proxy.ts`, next to `api/instance-stats$`.
- New `lib/instance-stats/invariants.ts`, with `export async function runInvariantCounts(db): Promise<InvariantReport>`:
  - for each entry of `INVARIANT_CHECKS` (`lib/invariants.ts`), run `SELECT count(*)::int AS n FROM (<check.query>) q`;
  - collect `{ name, violations: n }`;
  - the whole run has a 20 second budget; checks not run when it expires are reported as `{ name, violations: null, timedOut: true }`.
- Response 200: `{ ok: boolean, version: string, checkedAt: ISO string, checks: [{ name, violations, timedOut? }] }`.
  - `ok` is true when every check ran and every count is 0.
  - On a database error: 503 `{ ok: false }`, reported with `reportError("instance-invariants", e)`. No error text in the body.
- **Never** return ids, amounts or anything about a member: only check names and counts.
- Tests:
  - `lib/instance-stats/invariants.integration.test.ts`: a clean scope gives all zeros. One deliberate violation gives a count of 1 for that check only: use `product_max_quantity`, as `test/int/stock.integration.test.ts` does, and clean up after.
  - `app/api/instance-invariants/route.test.ts` (unit, with the signature helpers): 404 without a signature, with a stale one or with a wrong path; 200 with a fresh one.
  - A unit test that the response keys are exactly `ok, version, checkedAt, checks`, and per check `name, violations, timedOut`.

### Console: call it in the nightly cron

- New Console migration `console/drizzle/0001_fleet_checks.sql` (and `0001_fleet_checks_down.sql`): `ALTER TABLE instance_snapshots ADD COLUMN IF NOT EXISTS invariants jsonb`, `ADD COLUMN IF NOT EXISTS backup_at timestamptz`, `ADD COLUMN IF NOT EXISTS backup_ok boolean`. `backup_*` are used by WP2; adding them now saves a second migration.
- `console/lib/stats/probe.ts` (or a sibling `invariants-probe.ts`): sign and call `/api/instance-invariants` like the stats probe, with a 25 second timeout. Store the JSON in `instance_snapshots.invariants`. Store `{ ok: false, unreachable: true }` when the instance does not answer or answers 404, since 404 means an old version or a missing secret.
- `console/lib/fleet/refresh.ts`, run by `console/app/api/cron/refresh/route.ts` at 05:00 UTC: run the invariants probe after the stats probe, one instance at a time.
- `console/lib/alerts.ts`: the daily alert email to `CONSOLE_ALERT_EMAIL` lists every instance whose last invariants report is not `ok`, with the names of the failing checks and their counts, and nothing else.
- Fleet table (`console/lib/fleet/table.ts` and its page): a column "Conti" showing ok, the number of failing checks, or "non risponde". The Console's UI is Italian only, as today.
- Tests: unit for the probe's parsing, including unreachable and partial timeouts, for the alert text, and for the table cell.

### Rollout of WP1

- **Maintainer**: release as usual. The first production group keeps the `invariants` job of `backup.yml` until the Console has shown 14 nights that agree with it. Then a PR removes that job (`docs/status.md` notes the date).

### Done when

The Console shows a "Conti" value for every live instance on a supported version, and a deliberate violation on the demo, done on a throwaway Neon branch and never on production, appears in the next alert.

---

## WP2. Nightly backup and restore test for every instance

### Private repository `flylabs-ai/wegrocery-backups`

What it is, in short: `wegrocery` is public, so it cannot hold the list of paying groups nor the database passwords their backups need. This small private repository holds only that list and the backup jobs. Each night GitHub Actions runs, for every managed group, the same backup that `backup.yml` already does today for the first production group, encrypts the file and copies it to the backup folder; on Sunday it restores one of them as a test. The Console never sees the passwords: it only receives a signed "backup ok / failed" for its table.

**Maintainer**: create the private repository under the `flylabs-ai` organization, with MFA required and the maintainer as the only admin. An agent then fills it with:

- `instances.json`: `[{ "slug": "...", "folder": "...", "restore": true }]`. Slugs and folder names only, never a URL or a secret.
- `.github/workflows/fleet-backup.yml`:
  - `schedule: "0 3 * * *"` plus `workflow_dispatch`;
  - a `setup` job reads `instances.json` into a matrix;
  - the `backup` job uses `strategy: { matrix: ..., max-parallel: 2, fail-fast: false }` and `environment: backups`;
  - all actions pinned by commit SHA; no `pull_request` trigger.
- Steps of `backup`:
  1. install `postgresql-client` at the version that matches Neon (see the app's `backup.yml`), `age` and `rclone`;
  2. read the secret `BACKUP_DB_URL_<SLUG>`, where SLUG is upper case with `-` turned into `_`. If it is missing, fail that item with "secret missing" and never print the value;
  3. `pg_dump --no-owner --no-privileges "$URL" | gzip | age -r "$BACKUP_AGE_RECIPIENT" > "<slug>-<UTC date>.sql.gz.age"`;
  4. upload with `rclone copy` to `fleet:<folder>/`, then `rclone delete --min-age 90d fleet:<folder>/ --include "<slug>-*.sql.gz.age"`;
  5. report the result (below), success or failure.
- A final `notify` job opens one issue per night that lists the slugs that failed, or comments on the open issue. It never includes data or logs from the dump.
- `.github/workflows/fleet-restore-test.yml`, on Sunday at 04:30 UTC plus `workflow_dispatch`:
  1. pick the instance by rotation: ISO week number modulo the entries with `restore: true`;
  2. fetch its latest file;
  3. decrypt with the `BACKUP_AGE_KEY` secret (only this workflow's environment `restore` has it);
  4. create a throwaway branch in the restore Neon project with `neonctl` and `RESTORE_TEST_NEON_API_KEY`;
  5. restore, count the main tables, and run the money invariants with the app's `scripts/check-invariants.mts`, from a checkout of `flylabs-ai/wegrocery` at `main`;
  6. delete the branch in an `always()` step.
  The app's `restore-test.yml` is the model to copy.
- `README.md` in English: what runs when, the secrets by name only, how to add an instance, and how to rotate a role.

Secrets, all set by the **Maintainer** and never by an agent:

| Secret | Environment | What |
|---|---|---|
| `BACKUP_DB_URL_<SLUG>` | `backups` | connection string of that instance's `backup_ro` role |
| `BACKUP_AGE_RECIPIENT` | `backups` | the `age` public key (not secret, kept here for convenience) |
| `RCLONE_CONFIG` | `backups`, `restore` | access to the dedicated backup folder only |
| `FLEET_REPORT_SECRET` | `backups` | signs the report to the Console |
| `BACKUP_AGE_KEY` | `restore` | the `age` private key |
| `RESTORE_TEST_NEON_API_KEY` | `restore` | a Neon key scoped to the restore project |

- The private `age` key is generated by the **Maintainer** with `age-keygen`. Keep it in a password manager plus an offline copy, never in a repository. **[default]** For now only the maintainer holds it; a second trusted holder is a continuity decision for later.
- **[default]** Destination: Google Drive, a dedicated folder `WeGrocery-Backups/<slug>/`. Moving later to Cloudflare R2 with `eu` jurisdiction only changes `RCLONE_CONFIG`.
- **[default]** Instances the group hosts on its own accounts (`hosting_model = 'group_owned'`) stay out of the matrix: their backup is the group's responsibility, written in the contract. An entry can be added later, with the group's consent.

### App: a read-only backup role

- New `scripts/create-backup-role.mjs`, next to `scripts/create-app-role.mjs`, and reusing `scripts/db-migrate-lib.mjs` the same way. It creates or updates a role `backup_ro` with LOGIN and the given password, `GRANT USAGE ON SCHEMA public`, `GRANT SELECT ON ALL TABLES` and `ON ALL SEQUENCES IN SCHEMA public`, plus `ALTER DEFAULT PRIVILEGES ... GRANT SELECT` for tables created later. No INSERT, UPDATE, DELETE, TRUNCATE or DDL, and no ownership.
  - It is idempotent and refuses a role name that is not a plain identifier or a password shorter than 24 characters, the same checks as `appRoleStatements`.
  - It never prints the password, only the role name and the host.
- Pure statement builders in `scripts/db-migrate-lib.mjs` (`backupRoleStatements`), with unit tests in `scripts/db-migrate-lib.test.ts` in the style of the existing `appRoleStatements` tests. An integration test checks that `backup_ro` can SELECT a table and cannot insert into `ledger_entries`, cannot create a table, and cannot read `_migrations` for writing.
- `docs/self-hosting.md` and `docs/operating-two-environments.md`: one paragraph each on what the role is for.

### Console: create the role at provisioning, receive the report

- `console/lib/provisioning/app-role.ts`: in the same step that creates `app_rw`, also create `backup_ro`, using the same builders, ported or imported as the Console already does for `app_rw`. Show its connection string **once** in the step's result, with the line "Copia questa stringa nel segreto `BACKUP_DB_URL_<SLUG>` della repo wegrocery-backups: non viene salvata". Never store it.
- New route `console/app/api/backup-report/route.ts`, `POST`:
  - body `{ slug, ok, finishedAt }`;
  - signed with the same HMAC scheme as the stats (`<ts>.POST./api/backup-report`, 5 minute window) using `FLEET_REPORT_SECRET`, a new Console env var documented in `console/lib/env.ts`;
  - it only writes `backup_at` and `backup_ok` on the instance's latest snapshot, or inserts a snapshot when none exists today;
  - 404 on a bad signature or an unknown slug.
- Fleet table: a column "Backup" with the date of the last ok backup. It turns red after 36 hours without one. The daily alert lists those instances.
- Tests: the signature, unknown slug, idempotent repeat, and the column state.

### Rollout of WP2

- **Maintainer**, for each existing instance:
  1. run `scripts/create-backup-role.mjs` with that instance's owner URL;
  2. put the string into the matching `BACKUP_DB_URL_<SLUG>` secret;
  3. add the slug to `instances.json` through a PR on the private repo.
- The first production group joins the matrix. Its current `backup.yml` keeps running until the matrix has 14 green nights. Then the maintainer removes its `DATABASE_URL` secret, and a PR notes in `docs/status.md` that the public workflow now serves self-hosters only.
- The data processing register and the DPA name Google Drive as a sub-processor (maintainer, outside the code).

### Done when

Two consecutive nights are green for every live managed instance, the Console shows "Backup" for each of them, and one Sunday restore test has passed.

---

## WP3. Full data export for the admin

### Behaviour

- Admin, Impostazioni, Tecniche: a card "Esporta tutti i dati" with a button. It is visible to the `admin` role only, not to `referente`.
- A confirm dialog says the file will contain the personal data of every member. Then the browser downloads `wegrocery-<slug or app name>-<YYYY-MM-DD>.zip`.
- The zip contains:
  - one CSV per table, UTF-8 with BOM, `;` separator, CRLF line ends, ISO dates in UTC, decimals with `.`;
  - `LEGGIMI.txt` in the group's language: what each file holds, the app version, the export date, and how to rebuild a balance from the movements file;
  - `schema.sql`, the structure without data, built from `information_schema`, never from `pg_dump`.
- **[default]** CSV only. No JSON export and no import into another instance in this WP.

### Tables

- **Included**: `members` (without auth columns), households and household invitations, `order_cycles`, `products`, `orders`, `order_drafts`, `ledger_entries` in full (reversals included), `payments`, `refunds`, cycle pickups, suppliers and the supplier catalog, notifications and preferences, `audit_log`, `app_settings`, the brand identity, and `membership_requests`.
- The brand logo, when stored in the database, goes in the zip as a separate file.
- **Excluded**, always:
  - Better Auth's tables (sessions, accounts, verifications, rate limits);
  - `stripe_connection` and any column holding a sealed key;
  - `_migrations`;
  - anonymous usage events.

  Keep the list in one module, `lib/export/tables.ts`. Every included table lists its columns explicitly, never `SELECT *`, so that a new column must be added on purpose.

### Implementation

- `lib/export/csv.ts`: a pure CSV writer (quotes, embedded `;`, quotes and line breaks, null as empty, booleans as `true`/`false`).
- `lib/export/build.ts`: streams the zip with `fflate`, which is already a dependency (`Zip` plus `ZipDeflate`). It reads each table in pages of 5,000 rows ordered by primary key, so memory stays flat.
- `app/api/admin/export/route.ts`, `GET`:
  - requires an admin session (the same helper as the admin server actions);
  - returns the stream with `Content-Disposition: attachment` and `Cache-Control: no-store`;
  - allows at most 3 exports per hour per instance, counted from `audit_log` rows with `action = 'data_export'` (429 beyond that);
  - writes the audit row with table names and row counts only.
- The demo allows it, with its fake data.
- Guide: an admin card "esporta-dati" in `lib/guide/admin/*.ts`, in 4 languages.

### Tests

- Unit tests for the CSV writer.
- Integration, `test/int/data-export.integration.test.ts`:
  - the zip lists exactly the expected files;
  - no column of the excluded tables appears in any CSV header (the test reads the excluded tables' columns from `information_schema` and checks the headers);
  - **balance round trip**: per member, the sum of `amount` in `ledger_entries.csv` equals `SELECT sum(amount) FROM ledger_entries WHERE member_id = ...`;
  - the rate limit refuses the fourth export in an hour.
- By hand: open the demo's export in LibreOffice and Excel, and check that accents and amounts read correctly.

### Done when

An admin of the demo downloads the file, the round trip test passes, and the guide card is in 4 languages.

---

## WP4. Shared email sender with Reply-To

- **[default]** Sending subdomain `mail.wegrocery.app`. **Maintainer**: buy `wegrocery.app` (WP5), verify the subdomain on Resend (SPF, DKIM, DMARC at `p=none` for a month, then `p=quarantine`), and set it as `CONSOLE_SHARED_MAIL_DOMAIN` on the Console.
- App: every email sent through `sendMail` and `sendMailBatch` (`lib/email/resend.ts`) passes `replyTo` set to the group's contact address (the brand identity's support email) when one is set. Today `replyTo` is supported but not passed by the templates.
  - Add it in one place, the helper that builds the common layout, so no template can forget it.
  - Unit tests check that every template's send call carries it.
- App: an optional `EMAIL_DAILY_CAP` env var, a number per instance. When set, the app stops sending non-sign-in emails after that many in a UTC day and logs one warning. Sign-in codes and links are never capped by it; `lib/auth/email-caps.ts` keeps its own per-address limits.
  - Document it in `.env.example`, `lib/config-status.ts` and `docs/upgrading.md`.
  - The Console writes it at provisioning, **[default]** 300.
- Console: the "Email" step of the wizard proposes the shared sender by default, with sender `"<group name>" <slug@mail.wegrocery.app>`. A group with its own domain keeps the current path.
- Done when a test instance on the shared sender sends a sign-in code and an order email, and a reply lands in the group's inbox.

---

## WP5. `*.wegrocery.app` subdomains

- **Maintainer**: buy `wegrocery.app` and put it on Vercel nameservers in the team that holds the projects. After WP0 that is the Pro account.
- Console:
  - the "Dominio" step proposes `<slug>.wegrocery.app` by default. It adds that exact domain to the instance's project, never a wildcard shared between projects, then updates `APP_BASE_URL` and redeploys from the GitHub source, as the step already does for custom domains;
  - a group's own domain stays possible and becomes the primary one.
- `console/lib/slug.ts`: add `app`, `mail`, `status`, `docs` and `help` to `RESERVED`, keeping the current ones. Extend `slug.test.ts`.
- Cookies stay host-only: nothing on `.wegrocery.app`. Add a check in the app's auth config test that no cookie domain is set.
- Per instance, the step's checklist reminds the operator of:
  - Google redirect URIs, when Google sign-in is on;
  - the Stripe webhook endpoint URL, when the instance has Stripe connected in the app (the app's "Collega Stripe" recreates it).
- Done when a new test instance answers on its subdomain with a valid certificate and sign-in works there.

---

## WP6. Fleet rollout without a browser, with a canary

- Console migration `console/drizzle/0002_rollouts.sql` (and `_down`):
  - `rollouts (id, release_tag, commit_sha, status CHECK IN ('running','waiting_confirm','paused','failed','done'), created_at, created_by, observe_until timestamptz)`;
  - `rollout_items (rollout_id, instance_id, wave int, status CHECK IN ('pending','deploying','checking','done','failed'), deployment_id, started_at, finished_at, error)`;
  - with a unique index on `(rollout_id, instance_id)`.
- Keep the pure state machine in `console/lib/fleet/rollout.ts`. Extend `nextRolloutAction` with waves, the observation pause, the confirm gate and the weekend rule (no step on Saturday or Sunday, Europe/Rome). Unit tests cover every transition.
- Waves, from `rollout_order` and `hosting_model`:
  1. demo and example brand;
  2. observation pause, **[default]** 2 hours, during which health and the WP1 invariants are checked every tick;
  3. managed customers one at a time;
  4. the **first production group**, which **never starts by itself**: the rollout stops in `waiting_confirm` until the maintainer presses "Prosegui" in the Console, after the manual migration and backup, as today.
- Each tick (`console/app/api/cron/rollout/route.ts`, every 5 minutes, possible since WP0) does at most one short action:
  - create a production deploy of the release commit via `gitSource`, as the wizard does;
  - or poll the deployment until `READY`;
  - or check `/api/health` for the expected version plus `/api/instance-invariants` all ok, and pending migrations from the signed stats.

  Any failure sets the item and the rollout to `failed`, sends one email to `CONSOLE_ALERT_EMAIL`, and stops. The failed instance stays on its previous deployment.
- A release whose `CHANGELOG.md` entry is marked `[tecnico] migrazione non additiva` makes the rollout ask for confirmation before wave 3.
- "Rollback" button per done item: promote that project's previous production deployment through the Vercel API.
- **[default]** v1 starts only by hand ("Avvia giro" for the latest release). Starting automatically from `release.yml` comes after 3 clean rounds, as a separate PR.
- The current browser-driven mode stays, as "manuale".
- `console/vercel.json`: add the rollout cron. Keep the 05:00 refresh.
- Done when a rollout of a patch release runs through demo, example brand and one test instance unattended, and stops at the confirm gate before the production group.

---

## After phase 2

Phases 3 to 5 of the business plan (referrals, growing the hosted offer, self-service SaaS only past its thresholds, CSA boxes) are commercial or conditional: there is no code spec for them yet. The next code spec is written when the maintainer starts one of them. Until then, an agent picks the next WP above, or an item listed under "Planned" in `docs/status.md`.
