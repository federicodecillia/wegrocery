# Status: where the work stands

The living snapshot of what is released, what waits on `staging` and what is planned. Any agent (Claude Code, Codex or another) reads it before starting and updates it in the same PR that changes the picture: a release, a migration applied somewhere, a plan approved or dropped. Keep it short; the detail lives in `CHANGELOG.md`, the dated plans in `docs/` and the PRs.

Last updated: 2026-11-09 (example recovery retry stopped; transfer scope under review).

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

- Launch phase 2, "safe fleet": [work packages and Maintainer boundaries](./2026-11-09-launch-phase2-fleet.md). WP0 A.1 released; GitHub transfers and app access confirmed. Post-transfer checks and Vercel reconnection remain pending; keep the main/staging merge/push freeze. [Neon/Vercel isolation options](./2026-11-09-neon-vercel-isolation-plan.md) replace the unsupported ordinary managed-organization transfer/single-organization default. Customer and Console placement remains undecided; no transfer is approved.
- Example-only recovery work, draft PR #407: [runbook](./2026-11-09-example-transfer-runbook.md), [executor contract](./2026-11-09-local-recovery-runner.md). The maintainer authorized R1, then separately approved a non-login/non-admin `app_rw` ACL-holder on the isolated target and a repeated trial. The role was created and its flags verified. Both encrypted exports passed; each source pre/post report matched across 29 tables and 55 migration records, with 19 invariants at zero violations. The second restore also stopped; target catalog still reports zero user relations/functions. Source remains unchanged and authoritative. The second error is not diagnosed; file/tool/checksum/decryption and read-only target checks passed. No further restore retry or source change is in progress. The maintainer questioned whether logical DB migration is needed: provider documentation describes linked managed Neon transfer with the Vercel project, distinct from dump/restore. Reassess that supported path before further recovery-tool work; no logical production DB migration is required by the repository transfer. The target is only a recovery-test copy, never a cutover destination. Artifacts/key/target retained through 2026-11-16 without automatic cleanup. No disconnection, transfer or deploy performed; recovery gate has not passed, and any change to that planning gate needs an explicit revised decision. Console/customer resources remain outside this trial.
- Possible next steps, undecided: comments from members on the calendar and Home; moving more pieces (planned cycles) into the FlyLabs Kit.

## Known open items

- Deploy Health on release commit `3015523`: runs `42621910904` (Console) and `42621987253` (demo) received HTTP 302 from deployment URLs. Production/staging checks passed and the demo public health endpoint reports healthy 1.45.1. Investigate deployment URL redirects and the Console-specific health contract separately; do not treat these failed runs as green.
- Autonomous manual backup dispatch: requested by the maintainer, not yet enabled. The current GitHub CLI credential cannot dispatch workflows (403); do not broaden credentials or change production backup behavior without a scoped access plan.

- Issue #383: Dependabot advisories that do not affect the app (tracking).
- Issue #111: ESLint 10, blocked upstream by `eslint-config-next`.
- Issue #199: turn `set-state-in-effect` back on.

## Where the rest of the context lives

The repository is public, so specs with group details, business plans and the maintainer's to-do list are kept outside it, in the maintainer's private notes (see "Context outside the repository" in `AGENTS.md`). An agent without access to them works from this file, `AGENTS.md` and the dated plans in `docs/`, and asks the maintainer for anything else.
