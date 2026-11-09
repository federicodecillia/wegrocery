# Status: where the work stands

The living snapshot of what is released, what waits on `staging` and what is planned. Any agent (Claude Code, Codex or another) reads it before starting and updates it in the same PR that changes the picture: a release, a migration applied somewhere, a plan approved or dropped. Keep it short; the detail lives in `CHANGELOG.md`, the dated plans in `docs/` and the PRs.

Last updated: 2026-11-09 (approved temporary recovery project created; no data copied).

## Versions and migrations

| Installation | Version | Migrations applied |
|---|---|---|
| Production (`main`) | 1.45.1 (2026-11-09) | up to `0054` |
| Public demo (`main`) | 1.45.1 | up to `0054` |
| Example brand installation | 1.45.1 | up to `0054` (migrates on build) |
| Staging (`staging`) | 1.45.1 | up to `0054` (Neon branch `staging`) |

## Waiting on `staging` for the next release

Nothing awaiting a product release. Version 1.45.1 was released through PR #404 (merge commit `3015523`), staging fast-forwarded to that commit, and the example brand aligned (`0ed3d0e`). Public health endpoints on production, demo and example brand report `ok: true`, `db: true`, version `1.45.1`; staging Deploy Health passed before promotion. Manual backup and money invariants passed in run `42618843367`. No database migrations or Vercel transfers were performed as part of that release.

WP0 A.1 is released. The maintainer has now transferred both repositories to `flylabs-ai`; the upstream remains public and example-brand private, verified through GitHub. Organization 2FA/Owner status and all-repository access for Vercel, Claude and Codex were confirmed by the maintainer. Post-transfer ruleset/secret-name/workflow checks, local remote cleanup and Vercel Git reconnection are not yet verified. Keep the merge/push freeze on `main` and `staging` until reconnection is cleared. No Vercel or database move is authorized by the new planning proposal.

## Released in 1.45.0, off by default

Launch phase 1 ([plan](./2026-11-07-launch-phase1.md)): terms and privacy acceptance, open sign-up and `/aderisci`, public page `/gruppo`, member import from CSV, limited quantities (also from the listing import). Better Auth 1.7.18 (GHSA-965c-763c-88jm, not exploitable here; sign-in links emailed before the deploy stopped working, codes did not). `/api/health` checked on every deploy from GitHub Actions.

Still to do before a group turns on limited quantities with card payments: a Stripe sandbox run on staging (a Checkout that holds the units, a late payment refunded when the product ran out).

## Planned and in progress

- Launch phase 2, "safe fleet": executable spec in `docs/2026-11-09-launch-phase2-fleet.md`. Work packages in order: WP0 (move the repositories to `flylabs-ai` and the Vercel projects to the Pro account, the maintainer wants it first), WP1 (invariants per instance), WP2 (backups and restore tests, private repo `flylabs-ai/wegrocery-backups`), WP3 (data export), WP4 (shared sender), WP5 (subdomains), WP6 (rollouts). One PR per work package to `staging`. Choices marked **[default]** stand unless the maintainer changes them; steps marked **Maintainer** (transfers, private repo, secrets, keys, domain) are done by him, so stop and ask when one blocks you. WP0 A.1 is released in 1.45.1. GitHub transfers and app access were confirmed; parts A.3/A.4 and B remain pending. [Neon/Vercel isolation options](./2026-11-09-neon-vercel-isolation-plan.md) replace the old single-organization/direct-transfer default. The maintainer is open to both approaches and separate customer/Console boundaries. Phase 0 read-only inventory is approved: Vercel team plans/Git links, Neon organization plans, five project versions/branches and current-month usage counters were collected. Maintainer screenshots now show separate resources labeled Free, the example app consumer on All Environments and a disabled single-resource Transfer Database entry requiring disconnection. The [example recovery-first runbook](./2026-11-09-example-transfer-runbook.md) is prepared only; secure export execution, isolated target/budget, tested recovery, destination eligibility and the transfer itself are not approved. Console/customer resources remain outside the trial. The exact option and execution are not approved. Preparation of a [bounded local recovery runner](./2026-11-09-local-recovery-runner.md) was approved: offline by default, explicit encrypted-export command, no restore or transfer command. Ten local tests and a real age round trip on synthetic data passed; no database was contacted. The maintainer confirmed fake-only example data and separately approved one new isolated recovery project: PostgreSQL 18, Frankfurt, fixed 0.25 CU, Free subscription, no app connected. Creation and metadata were verified; no source connection, data export or restore occurred. Explicit suspension configuration was rejected by the Free plan before creation; the project uses provider defaults (API reports 0, while the documented Free policy fixes inactivity suspension at five minutes; behavior not yet observed). Secure configuration, restore execution/count-only validation and approval to copy data remain pending.
- Possible next steps, undecided: comments from members on the calendar and Home; moving more pieces (planned cycles) into the FlyLabs Kit.

## Known open items

- Deploy Health on release commit `3015523`: runs `42621910904` (Console) and `42621987253` (demo) received HTTP 302 from deployment URLs. Production/staging checks passed and the demo public health endpoint reports healthy 1.45.1. Investigate deployment URL redirects and the Console-specific health contract separately; do not treat these failed runs as green.
- Autonomous manual backup dispatch: requested by the maintainer, not yet enabled. The current GitHub CLI credential cannot dispatch workflows (403); do not broaden credentials or change production backup behavior without a scoped access plan.

- Issue #383: Dependabot advisories that do not affect the app (tracking).
- Issue #111: ESLint 10, blocked upstream by `eslint-config-next`.
- Issue #199: turn `set-state-in-effect` back on.

## Where the rest of the context lives

The repository is public, so specs with group details, business plans and the maintainer's to-do list are kept outside it, in the maintainer's private notes (see "Context outside the repository" in `AGENTS.md`). An agent without access to them works from this file, `AGENTS.md` and the dated plans in `docs/`, and asks the maintainer for anything else.
