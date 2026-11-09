# Status: where the work stands

The living snapshot of what is released, what waits on `staging` and what is planned. Any agent (Claude Code, Codex or another) reads it before starting and updates it in the same PR that changes the picture: a release, a migration applied somewhere, a plan approved or dropped. Keep it short; the detail lives in `CHANGELOG.md`, the dated plans in `docs/` and the PRs.

Last updated: 2026-11-09 (release 1.45.1 verified).

## Versions and migrations

| Installation | Version | Migrations applied |
|---|---|---|
| Production (`main`) | 1.45.1 (2026-11-09) | up to `0054` |
| Public demo (`main`) | 1.45.1 | up to `0054` |
| Example brand installation | 1.45.1 | up to `0054` (migrates on build) |
| Staging (`staging`) | 1.45.1 | up to `0054` (Neon branch `staging`) |

## Waiting on `staging` for the next release

Nothing awaiting a product release. Version 1.45.1 was released through PR #404 (merge commit `3015523`), staging fast-forwarded to that commit, and the example brand aligned (`0ed3d0e`). Public health endpoints on production, demo and example brand report `ok: true`, `db: true`, version `1.45.1`; staging Deploy Health passed before promotion. Manual backup and money invariants passed in run `42618843367`. No migrations or transfers were performed.

WP0 A.1 is released: repository guards, Console defaults and public setup links are ready for the future `flylabs-ai` upstream. Next is the Maintainer-only GitHub transfer checklist in [the phase 2 plan](./2026-11-09-launch-phase2-fleet.md). Stop before those steps; post-transfer checks/cleanup and Vercel transfers are not done.

## Released in 1.45.0, off by default

Launch phase 1 ([plan](./2026-11-07-launch-phase1.md)): terms and privacy acceptance, open sign-up and `/aderisci`, public page `/gruppo`, member import from CSV, limited quantities (also from the listing import). Better Auth 1.7.18 (GHSA-965c-763c-88jm, not exploitable here; sign-in links emailed before the deploy stopped working, codes did not). `/api/health` checked on every deploy from GitHub Actions.

Still to do before a group turns on limited quantities with card payments: a Stripe sandbox run on staging (a Checkout that holds the units, a late payment refunded when the product ran out).

## Planned and in progress

- Launch phase 2, "safe fleet": executable spec in `docs/2026-11-09-launch-phase2-fleet.md`. Work packages in order: WP0 (move the repositories to `flylabs-ai` and the Vercel projects to the Pro account, the maintainer wants it first), WP1 (invariants per instance), WP2 (backups and restore tests, private repo `flylabs-ai/wegrocery-backups`), WP3 (data export), WP4 (shared sender), WP5 (subdomains), WP6 (rollouts). One PR per work package to `staging`. Choices marked **[default]** stand unless the maintainer changes them; steps marked **Maintainer** (transfers, private repo, secrets, keys, domain) are done by him, so stop and ask when one blocks you. WP0 A.1 is released in 1.45.1. The maintainer next verifies organization 2FA/ownership, transfers both repositories, installs the GitHub Apps and reconnects Claude/Codex. Parts A.3/A.4 and B remain pending.
- Possible next steps, undecided: comments from members on the calendar and Home; moving more pieces (planned cycles) into the FlyLabs Kit.

## Known open items

- Deploy Health on release commit `3015523`: runs `42621910904` (Console) and `42621987253` (demo) received HTTP 302 from deployment URLs. Production/staging checks passed and the demo public health endpoint reports healthy 1.45.1. Investigate deployment URL redirects and the Console-specific health contract separately; do not treat these failed runs as green.
- Autonomous manual backup dispatch: requested by the maintainer, not yet enabled. The current GitHub CLI credential cannot dispatch workflows (403); do not broaden credentials or change production backup behavior without a scoped access plan.

- Issue #383: Dependabot advisories that do not affect the app (tracking).
- Issue #111: ESLint 10, blocked upstream by `eslint-config-next`.
- Issue #199: turn `set-state-in-effect` back on.

## Where the rest of the context lives

The repository is public, so specs with group details, business plans and the maintainer's to-do list are kept outside it, in the maintainer's private notes (see "Context outside the repository" in `AGENTS.md`). An agent without access to them works from this file, `AGENTS.md` and the dated plans in `docs/`, and asks the maintainer for anything else.
