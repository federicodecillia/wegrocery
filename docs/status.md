# Status: where the work stands

The living snapshot of what is released, what waits on `staging` and what is planned. Any agent (Claude Code, Codex or another) reads it before starting and updates it in the same PR that changes the picture: a release, a migration applied somewhere, a plan approved or dropped. Keep it short; the detail lives in `CHANGELOG.md`, the dated plans in `docs/` and the PRs.

Last updated: 2026-11-09 (WP0 A.1 preparation; release remains 1.45.0).

## Versions and migrations

| Installation | Version | Migrations applied |
|---|---|---|
| Production (`main`) | 1.45.0 (2026-11-09) | up to `0054` |
| Public demo (`main`) | 1.45.0 | up to `0054` |
| Example brand installation | 1.45.0 | up to `0054` (migrates on build) |
| Staging (`staging`) | 1.45.0 | up to `0054` (Neon branch `staging`) |

## Waiting on `staging` for the next release

WP0 part A, step 1 is prepared in this PR: release and UI-check guards accept the future `flylabs-ai` owner and the current repository; the Console defaults to `flylabs-ai/wegrocery`; contributor and self-hosting links point there. No transfer, deployment or migration has been performed. Merge and release are still pending.

## Released in 1.45.0, off by default

Launch phase 1 ([plan](./2026-11-07-launch-phase1.md)): terms and privacy acceptance, open sign-up and `/aderisci`, public page `/gruppo`, member import from CSV, limited quantities (also from the listing import). Better Auth 1.7.18 (GHSA-965c-763c-88jm, not exploitable here; sign-in links emailed before the deploy stopped working, codes did not). `/api/health` checked on every deploy from GitHub Actions.

Still to do before a group turns on limited quantities with card payments: a Stripe sandbox run on staging (a Checkout that holds the units, a late payment refunded when the product ran out).

## Planned and in progress

- Launch phase 2, "safe fleet": executable spec in `docs/2026-11-09-launch-phase2-fleet.md`. Work packages in order: WP0 (move the repositories to `flylabs-ai` and the Vercel projects to the Pro account, the maintainer wants it first), WP1 (invariants per instance), WP2 (backups and restore tests, private repo `flylabs-ai/wegrocery-backups`), WP3 (data export), WP4 (shared sender), WP5 (subdomains), WP6 (rollouts). One PR per work package to `staging`. Choices marked **[default]** stand unless the maintainer changes them; steps marked **Maintainer** (transfers, private repo, secrets, keys, domain) are done by him, so stop and ask when one blocks you. Only WP0 A.1 is prepared. Stop before the Maintainer steps: release this preparation with explicit production approval, then the maintainer verifies organization 2FA/ownership, transfers both repositories, installs the GitHub Apps and reconnects Claude/Codex. Parts A.3/A.4 and B remain pending.
- Possible next steps, undecided: comments from members on the calendar and Home; moving more pieces (planned cycles) into the FlyLabs Kit.

## Known open items

- CI runtime optimization: [measurement and implementation plan](./2026-11-09-ci-runtime-optimization.md), proposed on 2026-11-09, not approved for implementation. Start with profiling and batching test-only reads; isolated database shards and documentation-only classification are conditional follow-ups. No checks have been removed or changed.

- Issue #383: Dependabot advisories that do not affect the app (tracking).
- Issue #111: ESLint 10, blocked upstream by `eslint-config-next`.
- Issue #199: turn `set-state-in-effect` back on.

## Where the rest of the context lives

The repository is public, so specs with group details, business plans and the maintainer's to-do list are kept outside it, in the maintainer's private notes (see "Context outside the repository" in `AGENTS.md`). An agent without access to them works from this file, `AGENTS.md` and the dated plans in `docs/`, and asks the maintainer for anything else.
