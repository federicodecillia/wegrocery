# Status: where the work stands

The living snapshot of what is released, what waits on `staging` and what is planned. Any agent (Claude Code, Codex or another) reads it before starting and updates it in the same PR that changes the picture: a release, a migration applied somewhere, a plan approved or dropped. Keep it short; the detail lives in `CHANGELOG.md`, the dated plans in `docs/` and the PRs.

Last updated: 2026-11-09.

## Versions and migrations

| Installation | Version | Migrations applied |
|---|---|---|
| Production (`main`) | 1.44.0 (2026-11-05) | up to `0050` |
| Public demo (`main`) | 1.44.0 | up to `0050` |
| Example brand installation | 1.44.0 | up to `0050` (migrates on build) |
| Staging (`staging`) | 1.44.0 + `[Unreleased]` | up to `0054` (Neon branch `staging`) |

`package.json` still says 1.44.0 on `staging`: the release PR bumps it.

## Waiting on `staging` for the next release (1.45.0)

- Launch phase 1 ([plan](./2026-11-07-launch-phase1.md)), every feature off by default: terms and privacy acceptance (#388, `0051`), open sign-up and `/aderisci` (#389, `0052`), public page `/gruppo` (#390, `0053`), member import from CSV (#391), limited quantities (#392, #393, #395, `0054`).
- Better Auth 1.7.18 (#386, security advisory GHSA-965c-763c-88jm, not exploitable here). After deploy, sign-in links already emailed stop working; codes keep working.
- `/api/health` check on every deploy from GitHub Actions (#394).
- Dependency bumps (#396).

Before the release: a Stripe sandbox run on staging with a limited-quantity product (checkout, sold out, refund), then the release PR `staging` → `main` with the release template, migrations `0051`-`0054` on production and demo after a green manual backup, with the maintainer's explicit ok for each production step. Then align `wegrocery-example-brand`.

## Planned, not started

- Launch phase 2, "safe fleet": per-instance backups, invariants and restore tests, rollouts driven by the Console's cron. Proposal only: no code until the maintainer approves it.
- Possible next steps, undecided: comments from members on the calendar and Home; moving more pieces (planned cycles) into the FlyLabs Kit.

## Known open items

- Issue #383: Dependabot advisories that do not affect the app (tracking).
- Issue #111: ESLint 10, blocked upstream by `eslint-config-next`.
- Issue #199: turn `set-state-in-effect` back on.

## Where the rest of the context lives

The repository is public, so specs with group details, business plans and the maintainer's to-do list are kept outside it, in the maintainer's private notes (see "Context outside the repository" in `AGENTS.md`). An agent without access to them works from this file, `AGENTS.md` and the dated plans in `docs/`, and asks the maintainer for anything else.
