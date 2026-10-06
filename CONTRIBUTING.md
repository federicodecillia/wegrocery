# Contributing to WeGrocery

Thanks for your interest in WeGrocery. This is a real product: it handles the
money of real buying groups every week, and every merge reaches each
deployment. This guide explains how to propose a change so that it can be
reviewed and shipped safely.

By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

## Contents

- [Ways to contribute](#ways-to-contribute)
- [Before you start](#before-you-start)
- [Ground rules](#ground-rules)
- [Development setup](#development-setup)
- [Making a change](#making-a-change)
- [Pull requests](#pull-requests)
- [Review and release](#review-and-release)
- [Security issues](#security-issues)
- [License](#license)

## Ways to contribute

- **Report a bug**: open a [bug report](https://github.com/federicodecillia/wegrocery/issues/new?template=bug_report.yml).
  Reproduce it on the [public demo](https://wegrocery-demo.vercel.app) if you
  can: it runs the same code on fake data.
- **Suggest a feature**: open a [feature request](https://github.com/federicodecillia/wegrocery/issues/new?template=feature_request.yml)
  that describes the problem your group has, not only the solution.
- **Improve the docs**: typos, unclear steps in [SETUP.md](SETUP.md) or
  [docs/self-hosting.md](docs/self-hosting.md), missing explanations.
- **Translate**: the UI ships in Italian and English (`lib/i18n/`). A new
  language is a new pack typed against the Italian one.
- **Write code**: fix a bug or build something agreed on in an issue.
- **Run it for your group**: tell us about your setup in an issue. Real usage
  is the most useful feedback there is.

Look for issues labelled `good first issue` or `help wanted` if you want a
place to start.

## Before you start

- **Small fixes** (a typo, an obvious bug, a missing test): open a pull
  request directly.
- **Anything larger** (a new feature, a schema change, a new environment
  variable, a change to how money moves): open an issue first and wait for
  agreement on the approach. A short written plan saves you from rewriting a
  PR that cannot be merged as is.
- Check the open [issues](https://github.com/federicodecillia/wegrocery/issues)
  and [pull requests](https://github.com/federicodecillia/wegrocery/pulls) so
  you do not duplicate work, and comment on an issue to say you are taking it.

## Ground rules

These are the rules a change is reviewed against. They exist because the app
runs in production with real members and real money.

1. **White-label, always.** One codebase serves every group. Nothing specific
   to one group goes into the code: differences live only in environment
   variables (secrets and integrations), in the database (settings an admin
   changes from the app) and in the brand JSON (`NEXT_PUBLIC_BRAND_JSON`:
   name, logo, colours, language, currency). Every feature must work with the
   optional integrations off (Stripe, Google sign-in, the membership-card
   check, Sentry): the demo is exactly that case.
2. **Money is append-only.** `ledger_entries` refuses UPDATE and DELETE at the
   database level. A correction is a reversal plus, for an edit, a
   replacement (`lib/ledger-reversal.ts`); any filter by entry type goes
   through `liveLedger` (`lib/db/ledger-live.ts`). A new money rule gets a
   read-only check in `lib/invariants.ts` and a case in
   `lib/invariants.int.test.ts`; those checks run every night on production.
3. **No secrets or personal data, anywhere.** The repository and its CI logs
   are public. Never commit `.env*` files, connection strings, API keys, or
   real names, emails or balances, and do not paste them into issues, PRs or
   logs. Tests, fixtures and seeds use invented data only. A script that
   writes to a database must refuse a production host unless an explicit
   flag is passed.
4. **Migrations are additive and run from zero.** A schema change is a new
   `drizzle/NNNN_*.sql` file (idempotent, additive where possible), also
   listed in `lib/migrations.ts`. CI applies every migration to an empty
   database, so it must work from `0000` too.
5. **Accessible by construction.** Colours come from brand tokens, never
   hard-coded; every text and background pair reaches WCAG AA; no text under
   12 px. `lib/brand/design-guard.test.ts` enforces most of it.
6. **Languages.** Code, identifiers, comments, commit messages, PR
   descriptions and docs are in English. UI strings live in the language
   packs (`lib/i18n/it.ts` is the source, `en.ts` is type-checked against it),
   never inline in components.

[AGENTS.md](AGENTS.md) is the full reference: architecture, data model,
business rules and what to update with each kind of change. Read the sections
that touch your change before writing code.

## Development setup

Follow [SETUP.md](SETUP.md): Node.js 24, a free Postgres database on
[Neon](https://neon.tech), `.env.local` from `.env.example`, `npm run
db:migrate`, then `npm run dev`. `AUTH_DEV_LOGIN_EMAIL` gives you a sign-in
button in development, so you need neither email nor Google.

Use a database of your own with fake data (`npm run db:seed:demo` fills one).
Never point a development environment at a real group's database.

## Making a change

1. **Fork** the repository and create a branch from `staging` (not `main`):
   ```bash
   git checkout -b fix/short-description origin/staging
   ```
   Branch names are free; `fix/…`, `feat/…` and `docs/…` read well.
2. **Keep it focused.** One change per PR. A bug fix is a bug fix, not a
   refactor of the surrounding code.
3. **Match the code around you**: naming, comment density, file layout. Reads
   happen in Server Components (`lib/db/queries.ts`), writes in Server
   Actions guarded by `requireActiveMember()` / `requireAdmin()`, followed by
   `revalidatePath()`. Expected refusals are returned as values, not thrown
   (see "Key Business Rules" in AGENTS.md).
4. **Test it.**
   - Pure logic gets a unit test next to the source (`*.test.ts`, Vitest,
     no database). Unit tests import `.ts` files only.
   - Queries, guarded writes and migrations get an integration test
     (`*.int.test.ts`) when a unit test cannot show the behaviour; build rows
     with `makeScope()` from `test/int/fixtures.ts`.
   - UI changes: check them in the browser, on a phone width (375 px) as well
     as a desktop one, and include screenshots in the PR.
5. **Run what CI runs** before pushing:
   ```bash
   npx tsc --noEmit && npm run lint && npm test
   ```
   Lint runs with zero warnings allowed. Integration tests need a test
   database (see SETUP.md); if you cannot run them, say so in the PR and CI
   will on the maintainer's side.
6. **Update what goes with the change**:
   - user-visible behaviour: an entry under `## [Unreleased]` in
     [CHANGELOG.md](CHANGELOG.md) and the same entry in
     [CHANGELOG.it.md](CHANGELOG.it.md), in plain words for members and
     admins (house style in AGENTS.md). If you do not write Italian, add the
     English one and say so in the PR: the maintainer translates it;
   - a new environment variable: `.env.example`, `lib/config-status.ts` and
     `docs/upgrading.md`, plus `docs/self-hosting.md` if a new installation
     needs it;
   - a new migration: `lib/migrations.ts`.
7. **Commit** with clear messages in the imperative mood ("Fix the shipping
   split on a cancelled order"), explaining why when it is not obvious.

## Pull requests

- Open the PR against **`staging`**. PRs against `main` are reserved for
  releases.
- Fill in the template: what changes for the user, how you tested it, and
  the checklist.
- Link the issue it resolves (`Closes #123`).
- Keep the PR up to date with `staging` by merging it in; there is no need to
  rewrite history.
- Draft PRs are welcome for early feedback.

CI runs typecheck, lint and unit tests on every PR. The integration job needs
secrets that forks do not have, so it is skipped on your PR and runs before
the release instead.

## Review and release

- The maintainer reviews PRs as time allows; expect questions, and feel free
  to ping after a week of silence.
- Accepted PRs are **squash-merged into `staging`**, tested on the staging
  deployment, then released to `main` with the other changes of that version
  (every deployment updates from `main`).
- A PR may be closed if it conflicts with the ground rules above or with the
  direction of the project; an issue first avoids that.

## Security issues

Do **not** open a public issue for a vulnerability. Follow
[SECURITY.md](SECURITY.md) and report it privately.

## License

WeGrocery is [MIT licensed](LICENSE). By contributing you agree that your
contribution is licensed under the same terms. The Porta Moneta name and logo
are not part of the license and must not be used in contributions.
