# Operating the environments: production, staging, demo

WeGrocery runs as **Vercel deployments from this single repository**. They
share 100% of the code and differ only in environment variables (and, for
staging, in the Git branch they build from).

| | Production | Staging | Demo |
|---|---|---|---|
| URL | `gas.portamoneta.org` | branch URL of `staging` on `porta-moneta` (see below) | `wegrocery-demo.vercel.app` |
| Vercel project | `porta-moneta` (client: Porta Moneta) | `porta-moneta`, Preview deployment | `wegrocery-demo` |
| Git branch | `main` | `staging` | `main` |
| Database | production Neon (real members) | Neon branch `staging` (copy of production) | separate demo Neon (fake data) |
| `DEMO_MODE` | unset | unset | `true` |
| Auth | Google OAuth + member whitelist | same, with the staging redirect URI | one-click Socio/Admin demo login |
| Outbound email | Resend | redirected to `EMAIL_REDIRECT_TO` | disabled |
| Data | real, persistent | real copy, resettable | reseeded nightly |

Local dev and ordinary PR previews keep using the Neon branch `dev`
(see AGENTS.md → "Database environments & access").

## One codebase, env-driven differences

Demo behaviour is **not** a branch or a fork. It lives behind the `DEMO_MODE`
flag:

- `auth.ts` registers the `demo-login` Credentials provider only when `DEMO_MODE=true`.
- `components/demo-banner.tsx` renders the banner only when the flag is on.
- `lib/email/resend.ts` short-circuits `sendMail` in demo so no mail is sent.

With the flag unset (production) none of that code path is reachable.

Both Vercel projects are connected to this repo with **Production Branch `main`**
and **Root Directory at repo root** (empty / not set). A merge to `main` rebuilds
both deployments automatically, each with its own env. Features stay in sync by
construction: it is the same commit.

**When adding a feature, ask how it behaves under `DEMO_MODE` and outside
production.** If it introduces an external side-effect (email, payments,
third-party calls), add a demo guard like the one in `sendMail`, and make sure
staging and previews cannot reach real people or real money: they run on a
copy of the production member list.

## Staging

Staging is where a change is tested end to end, on a copy of real data, before
it reaches `main` (and therefore production and the demo).

### Git flow

- Development PRs target **`staging`**, not `main`.
- `staging` → `main` only after the change has been tested on staging, through
  a PR and the promotion checklist below. Merge it with **"Create a merge
  commit"**, not squash, so the two branches do not diverge.
- Dependabot opens its PRs against the default branch (`main`). Routine
  bumps can keep going there; anything risky goes through `staging` first.

### Vercel: Preview deployment of the `staging` branch

Staging is **not** a separate Vercel project: it is the Preview deployment that
`porta-moneta` builds for every push to `staging`. Vercel gives each Git branch
a stable URL that always points to its latest deployment:

```
porta-moneta-git-staging-<scope-slug>.vercel.app
```

(`<scope-slug>` is the team slug shown in the deployment URLs; copy the exact
"Branch" URL from the deployment page, since Vercel may truncate it.) Preview
deployments may sit behind Vercel Authentication: log in to Vercel first.

Environment variables on `porta-moneta` → Settings → Environment Variables,
environment **Preview**, **Git branch `staging`**. A branch-specific value
overrides the generic Preview value of the same name, so only the differences
need to be set:

| Variable | Staging value |
|---|---|
| `DATABASE_URL` | connection string of the Neon branch `staging` |
| `EMAIL_REDIRECT_TO` | the tester's inbox (every email goes there, cc dropped, subject tagged `[STAGING -> <recipient>]`; broadcasts to all members are capped to 3 samples) |
| `APP_BASE_URL` | the staging branch URL, so email links do not point at production |
| `WALLYFOR_*` | membership-check credentials (the same read-only check as production) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe **sandbox** keys only (the app refuses live keys outside production). The sandbox webhook endpoint is `<staging URL>/api/stripe/webhook?x-vercel-protection-bypass=<secret>`, with the secret from Settings → Deployment Protection → Protection Bypass for Automation |

`EMAIL_REDIRECT_TO` must **never** be set on Production. Outside
`VERCEL_ENV=production` (staging, previews, local dev) the app refuses to send
any email unless it is set: this is the safety net for the real addresses in
the copied data.

### Google OAuth

In Google Cloud Console → the OAuth client used by production → *Authorized
redirect URIs*, add:

```
https://<staging branch URL>/api/auth/callback/google
```

Only the stable branch URL works: per-commit URLs change on every push and
cannot be whitelisted.

### Neon branch `staging`

`staging` is a copy-on-write child of `production` in project
`porta-moneta-app-gas`. Create it once:

```bash
npx -y neonctl branches create --name staging --parent production \
  --project-id small-breeze-14972344 --org-id org-gentle-violet-55538692
```

Refresh it from current production data (this
**destroys** everything written on staging, including migrations not yet on
production):

```bash
npx -y neonctl branches reset staging --parent \
  --project-id small-breeze-14972344 --org-id org-gentle-violet-55538692
```

After a reset, re-apply the pending migrations to staging (next section).

## Database migrations

Migrations are hand-written `drizzle/NNNN_*.sql` files (additive, idempotent,
pre-flight query in the header) applied with `scripts/db-migrate.mjs`, which
records applied files in `_migrations`. Order: **staging first, then
production**, then demo.

```bash
# 1. staging (connection string of the Neon branch "staging")
DATABASE_URL="…staging…" node scripts/db-migrate.mjs --status
DATABASE_URL="…staging…" node scripts/db-migrate.mjs

# 2. production — only at promotion time, with explicit confirmation,
#    after running the pre-flight query from the file header
DATABASE_URL="…production…" node scripts/db-migrate.mjs

# 3. demo (reads .env.demo.local)
node --env-file=.env.demo.local scripts/db-migrate.mjs
```

If you add a table or a non-null column, update `scripts/seed-demo.ts`
too, otherwise the nightly reset (`.github/workflows/demo-reset.yml`) will fail.

## Promotion checklist: staging → main

1. **Staging is green**: CI passes on the `staging` head, and the change was
   tested by hand on the staging URL (flows touched by the change, plus a
   login and the home balance).
2. **Manual backup**: Actions → "Daily Neon Backup" → *Run workflow*, and check
   the new `gas-backup-YYYY-MM-DD.sql.gz` on Drive. For a risky migration also
   create a Neon branch from `production` (e.g. `pre-release-YYYYMMDD`) as an
   instant restore point.
3. **Migrations on production**: `--status` shows the expected pending files;
   run each file's pre-flight query (must return 0 rows), then apply. Then demo.
4. **Changelog**: release cut in both `CHANGELOG.md` and `CHANGELOG.it.md`.
5. **Merge** the `staging` → `main` PR (merge commit). Vercel redeploys
   production and the demo.
6. **Smoke test production**: login, home balance, order page, admin panel,
   and the feature just shipped; check the Vercel runtime logs for errors. If
   something is wrong, use Vercel's Instant Rollback to the previous production
   deployment (additive migrations stay compatible with the previous code).

## Changelogs: shared product, separate demo

- **Product changelog** — `CHANGELOG.md` + `CHANGELOG.it.md`. Real app
  features (orders, ledger, analytics). Applies to both environments. This is
  what members and repo visitors read.
- **Demo-only changes** — `DEMO_MODE`, seed, nightly reset, demo login, banner —
  go in the "Demo environment changelog" section below, **not** in the product
  changelog.

Rule of thumb: if a line describes an **app capability**, it belongs in the
product changelog. If it describes the **showcase infrastructure**, it belongs
in the demo changelog.

### Demo environment changelog

- **2026-06-10** — Initial demo mode: `DEMO_MODE` flag, one-click Socio/Admin
  login, persistent banner, outbound email disabled, idempotent seed
  (`npm run db:seed:demo`), nightly reset workflow, separate Neon database and
  Vercel project.

## Public vs private links

- **`gas.portamoneta.org` is private.** Login is whitelisted and the data is
  real. Share it only with cooperative members. Never use it for screenshots,
  demos, or public links.
- **The staging URL is private too.** It serves a copy of the real data:
  same rules as production.
- **`wegrocery-demo.vercel.app` is the public showcase.** Use it in the
  README, in any demo, and for all screenshots/GIFs (the `docs/demo.gif`
  walkthrough was recorded here).
