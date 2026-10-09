# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WeGrocery** is an open-source, white-label web app for food co-ops and buying groups (born as the Porta Moneta GAS app, now its first client deployment). Members log in with Google, place weekly orders, and track their balance. Admins manage cycles, products, suppliers, and member topups. Branding/locale per deployment via `NEXT_PUBLIC_BRAND_JSON` (see `lib/brand` and `lib/i18n`).

**Stack**: Next.js 16 App Router · Postgres (Neon serverless) · Better Auth (email link, optional Google) · Drizzle ORM · Tailwind CSS v4 · Vercel

**Live**: gas.portamoneta.org

## Codebase structure

```
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Home: saldo hero, ciclo aperto, ultimi movimenti
│   ├── ordine/page.tsx         # Order: confirmed recap (edit/cancel) or the stepper form
│   ├── storico/page.tsx        # Order history + ledger movements tabs
│   ├── notifiche/page.tsx      # Notification list with mark-as-read
│   ├── profilo/page.tsx        # Profile (header avatar): name, emails, card, family, notifications, money, app, sign-out (privacy stays in the footer)
│   ├── guida/page.tsx          # Guide index: "Il nostro gruppo" (admin text), search, topics, news; cards in guida/[topic] (content in lib/guide)
│   ├── admin/page.tsx          # Admin: Ciclo ("Da fare ora" on top, lib/admin/cycle-phase.ts; workspace: cycle list + Panoramica/Prodotti/Ordini/Fornitore/Conti, components/admin/cycle-workspace.tsx, lib/admin/cycle-views.ts) · Cassa · Soci · Catalogo (Prodotti, Fornitori) · ⋯ Statistiche, Impostazioni (lib/admin/nav.ts; old ?tab= links resolve)
│   ├── login/page.tsx          # Login with Google
│   └── api/auth/[...all]/      # Better Auth handler, limited to lib/auth/public-endpoints.ts
├── components/
│   ├── app-shell.tsx           # Async layout wrapper: header (logo, top nav from lg, bell, Profile avatar on one row) + bottom nav
│   ├── bottom-nav.tsx          # Bottom nav (4 items, 5 for admins), hidden from lg
│   ├── top-nav.tsx             # Same items in the header, from lg
│   ├── nav-items.ts            # Nav items + isItemActive (icons in nav-icon.tsx)
│   ├── shell-width.ts          # SHELL_WIDTH (one card width) + CONTENT_WIDTH (reading column vs wide)
│   ├── shell-skeleton.tsx      # Skeleton mirroring AppShell, used by loading.tsx files
│   ├── notification-bell.tsx   # Bell icon with red unread badge
│   ├── home/cycle-countdown.tsx
│   ├── admin/                  # Admin tab components (one per tab)
│   └── ui/                     # Button, Card, ConfirmDialog, Toast
├── lib/
│   ├── db/
│   │   ├── schema.ts           # Drizzle tables: members, order_cycles, products, orders, order_drafts,
│   │   │                       #   ledger_entries, payments, refunds, app_settings, notifications, audit_log, suppliers, supplier_products
│   │   ├── queries.ts          # All read queries + getUnreadNotificationCount
│   │   └── client.ts           # Neon connection (DATABASE_URL)
│   ├── actions/
│   │   ├── admin.ts            # Admin Server Actions: cycles, ledger, topup, members, suppliers,
│   │   │                       #   adminSendSupplierEmail, adminUpdateOrderLineActuals,
│   │   │                       #   adminEditClosedOrder
│   │   ├── admin-cycles.ts     # Cycle-specific actions
│   │   ├── admin-products.ts   # Product/catalog actions
│   │   ├── admin-settings.ts   # adminUpdatePaymentSettings (Impostazioni tab)
│   │   ├── admin-members.ts    # previewMemberMerge, adminMergeMembers (Soci → Unisci)
│   │   ├── notifications.ts    # markNotificationRead, markAllNotificationsRead
│   │   ├── profile.ts          # updateMyName (Profile: the signed-in person renames themselves)
│   │   └── order.ts            # saveOrder, saveOrderDraft, discardOrderDraft (member)
│   ├── email/                  # Resend wrapper + supplier-email templates
│   ├── csv/                    # Server-side CSV builders (e.g. supplier aggregated export)
│   └── auth/                   # session.ts: requireUserSession(), requireAdmin(), requireActiveMember(), getUserRole()
│                               #   access.ts: pure checkAccess/sessionClaims (no imports, used by proxy.ts)
├── proxy.ts                     # Redirect unauthenticated to /login (Next.js 16's middleware)
├── auth.ts                     # Better Auth instance, auth() (session + member), signOut()
├── drizzle/                    # SQL migrations (0000–0033)
├── console/                    # WeGrocery Console: separate Next.js app (own package.json, registry DB, Vercel project with
│                               #   Root Directory `console`) for the operator's fleet; excluded from the root tsc/eslint/vitest; see console/README.md
└── public/logo.png
```

## Development Commands

All commands from repo root:

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npx tsc --noEmit     # Type check (TypeScript 7 native `tsc`, see "Dev toolchain")
npm run lint         # ESLint CLI (flat config, eslint.config.mjs), zero warnings; `next lint` no longer exists
npm run db:push      # Push Drizzle schema to Neon (needs DATABASE_URL in .env.local)
npm run db:studio    # Drizzle Studio (visual DB browser)
npm run doctor       # Configuration status of the env in .env.local (names only)
npm test             # Unit tests (pure, no database)
npm run test:int     # Integration tests on a test database (see below)
```

**Integration tests** (`*.int.test.ts`, `vitest.int.config.ts`): the real queries against Postgres, for what unit tests cannot show (guarded writes, concurrent events, migrations). They run only with `INT_TEST_DATABASE_URL` set, or with `INT_TEST_USE_DATABASE_URL=1` when the `DATABASE_URL` in the environment is already a test database (e.g. `INT_TEST_USE_DATABASE_URL=1 node --env-file=.env.demo.local node_modules/vitest/vitest.mjs run -c vitest.int.config.ts`); otherwise they are skipped. Never point them at production. Each test builds its rows with `makeScope()` (`test/int/fixtures.ts`): one fake member per run, ids prefixed `int_`, removed in `afterAll`. The setup drops `RESEND_API_KEY` and `STRIPE_SECRET_KEY` from the environment, so a test can neither send an email nor call Stripe. In CI the `integration` job creates a throwaway Neon branch, applies the pending migrations and runs the suite; it needs the `NEON_API_KEY` secret and the `NEON_PROJECT_ID` variable and is skipped without them (forks). `NEON_PROJECT_ID` must be a project with fake data only (the demo), never production: the repository is public, so the job masks the branch's connection string before any step can print it.

**Configuration status**: `configStatus` (`lib/config-status.ts`, pure) lists what a deploy has set up, by variable name and state, never a value: the card in admin → Impostazioni and `npm run doctor` show it. A new migration goes in `lib/migrations.ts` too (a test compares it with `drizzle/`); a new environment variable gets an item there, a line in `.env.example` and a row in `docs/upgrading.md`. `MIGRATE_ON_BUILD=true` makes `npm run build` apply pending migrations first, on production builds (and builds outside Vercel) only. **New installations**: `docs/self-hosting.md` (Deploy to Vercel button, keep it in sync with the variables a deploy needs); `BOOTSTRAP_ADMIN_EMAIL` makes its address the first admin while no active admin exists (`lib/auth/admission.ts`). CI applies every migration to an empty database and runs `test/int/fresh-install.int.test.ts` there: a migration must work from `0000` too.

**Append-only ledger** (since `drizzle/0023_ledger_append_only.sql`): a trigger refuses every UPDATE and DELETE on `ledger_entries`, except setting `reversed_by` once. A correction is `reverseEntry` / `reverseEntrySql` (`lib/ledger-reversal.ts`): a `reversal` row with the opposite amount (`reverses` → the original, which gets `reversed_by`), plus, for an edit, a replacement of the same type (`replaces` → the original, same entry date, no bank reference). Cassa "edit" and "delete", the shipping recompute of a closed cycle and the supplier-sheet import all work this way. **Any filter by type must use `liveLedger`** (`lib/db/ledger-live.ts`: not reversed, not a reversal), or a corrected movement counts twice; plain sums (balances, a cycle's net) are the same either way. Movement lists show live rows only, a replacement with "corrected on <date>". The one-charge-per-member-and-cycle index counts live rows only. Maintenance that must delete rows sets `wegrocery.ledger_maintenance = on` in its own transaction (the integration tests' cleanup); the demo's TRUNCATE does not fire the trigger.

**Money invariants**: `lib/invariants.ts` lists read-only checks that must return no rows (refunded cents match the refunds, every accepted refund is debited, every paid payment credited once, every closed-cycle order charged...). The nightly backup workflow runs them on production (`scripts/check-invariants.mts`, job `invariants`, independent of the dump so a failed backup never skips it); a failure fails the run and the `notify` job opens (or comments on) a GitHub issue. Run them on any database with `node --env-file=<env> node_modules/tsx/dist/cli.mjs scripts/check-invariants.mts`. A new money rule gets a check there and a case in `lib/invariants.int.test.ts`.

**Nightly UI check**: `.github/workflows/ui-check.yml` runs `scripts/ui-check.mjs` after the demo reset: the main member and admin pages at 390 and 1280 px against the demo (`vars.UI_CHECK_URL`, else the public demo on the upstream repository; a `DEMO_MODE` deploy only, it signs in through the demo buttons). It fails on axe problems of serious or critical impact, horizontal scrolling and four keyboard paths (order stepper, focus back after a sheet, visible focus outline, Esc on the cycle-close review), and the `notify` job opens (or comments on) one issue. Labels are matched in English and Italian. Locally: install `playwright` and `@axe-core/playwright` next to a copy of the script and run it with `UI_CHECK_URL=http://localhost:3000` (`CHROMIUM_PATH` for a preinstalled browser).

**Releases**: open the `staging` → `main` PR with `?template=release.md` (`.github/PULL_REQUEST_TEMPLATE/release.md`): upgrade notes, migration before the merge, smoke test on `/api/health`, rollback. The merge to `main` tags `vX.Y.Z` and publishes the GitHub release by itself (`.github/workflows/release.yml`, notes from that version's `CHANGELOG.md` entry, upstream repository only). An installation whose Git deploys Vercel blocks sets the `VERCEL_DEPLOY_HOOK` repository secret: `.github/workflows/deploy-hook.yml` then calls the hook on every push to `main`.

**Health and errors**: `/api/health` (public) returns `{ ok, version, db }`, 503 when the database does not answer. Unexpected errors go through `reportError` (`lib/observability.ts`): always the server log, Sentry too when `SENTRY_DSN` is set (server only, errors only; data collection is off and `beforeSend` cuts the query parameters a driver error quotes; initialized in `instrumentation.ts`). Use it instead of a bare `console.error` for errors someone should look at.

**Stripe on staging**: `scripts/stripe-staging-check.mjs` runs real sandbox refunds against the staging deploy; it refuses live keys and any database other than `STAGING_DB_HOST`. The events the webhook endpoint must subscribe to are `REQUIRED_STRIPE_EVENTS` (`lib/payments/config.ts`).

**Deploy**: push to `main` → Vercel auto-deploys production. Development PRs target `staging` and are tested on its Preview deployment before `staging` → `main`; other branches create ordinary preview deployments.

**Vercel Root Directory**: repo root (empty / not set)

## Dev toolchain

- **TypeScript 7 runs `tsc`; TypeScript 6 serves the compiler API.** TS 7 ships
  without a JavaScript API, and typescript-eslint (peer `typescript <6.1`)
  needs one. `package.json` therefore has `"typescript": "npm:@typescript/typescript6"`
  (what `require("typescript")` resolves to: ESLint) next to
  `"@typescript/native": "npm:typescript@^7"` (provides the `tsc` binary: CI,
  `npx tsc --noEmit`, and `next build`, which uses the project-local `tsc` CLI).
  This is the side-by-side setup of the TS 7 announcement. Collapse it into a
  plain `typescript@^7` once typescript-eslint supports TS 7 (planned with the 7.1 API).
- **ESLint stays on 9** (`eslint-config-next` 16.3 and its canary bundle
  `eslint-plugin-react` / `-import` / `-jsx-a11y`, none of which support ESLint 10;
  `react/display-name` crashes). Tracked in #111.
- **`@types/node` 24** matches the Node major in CI, `SETUP.md` and Vercel's default.

## Dependencies and security advisories

Dependabot security updates are on, and `.github/dependabot.yml` schedules a
weekly grouped run. Advisories therefore arrive as pull requests with CI
attached — nobody has to act on an email. A scheduled agent triages them on
Monday mornings; it may open PRs and issues but never merges and never pushes
to `main`, because merging deploys straight to production.

When handling an advisory:

- **Judge reachability before severity.** Most advisories list preconditions in
  their "Am I affected?" section. Check them against the source. In July 2026
  four *critical* Auth.js advisories were all inert here: no magic-link
  provider, `getToken()` never called, one OAuth provider with no account
  linking, and every access check reads `session.user.email` rather than the
  truthiness of the auth object — so the fail-open bug denies instead. Say so
  in the changelog; "critical but not reachable" is the useful information.
- **Verify an override before adding one.** Forcing a transitive major can
  break its consumer: `brace-expansion` 5.x exports an object from its
  CommonJS entry while `minimatch` does `const expand = require(...)` and calls
  it as a function. `sharp` was a safe override while Next.js declared
  `^0.34.x`; Next.js 16.3 declares `^0.35.4` itself, so the override is gone
  (re-add it if a future release lags behind a `libvips` fix).
- **Confirm the fix landed** by comparing each alert's `first_patched_version`
  against the resolved tree, not by trusting the bump.
- **`better-auth` is pinned to an exact version on purpose** and sits in Dependabot's `ignore` list: sign-in upgrades are a deliberate decision, tested with `lib/auth/config.int.test.ts`.
- If an alert is genuinely unreachable and has no safe fix, dismiss it with
  `not_used` and open a tracking issue naming the condition to revisit it.

## Environments: production, staging, demo

This repo deploys to **two** Vercel projects, differing only by environment
variables, plus a staging deployment of the `staging` branch:

- **Production** — `gas.portamoneta.org`, real members, no `DEMO_MODE`,
  built from `main`.
- **Staging** — Preview deployment of the `staging` branch on the
  `porta-moneta` project, reached through its stable branch URL
  (`porta-moneta-git-staging-<scope>.vercel.app`). Env vars scoped to
  Preview + Git branch `staging`: `DATABASE_URL` → the Neon branch `dev`, like
  every Preview (a copy of production; there is no `staging` branch in the Neon
  project, checked 2026-09-30; migrations for staging go to `dev`),
  `EMAIL_REDIRECT_TO` (set only on the `staging` branch: other previews share
  `dev` but have none, so they refuse to send email),
  `APP_BASE_URL`, `WALLYFOR_*`, `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`
  (sandbox keys only). The Google OAuth client needs the staging
  branch URL's `/api/auth/callback/google` as an extra redirect URI.
- **Public demo** — `wegrocery-demo.vercel.app`, fake data, `DEMO_MODE=true`,
  reseeded nightly, built from `main`.

**Git flow**: development PRs target `staging`; `staging` → `main` only after
the change was tested on staging, following the promotion checklist (manual
backup, production migrations, merge commit, smoke test) in the doc below.
Migrations are applied to staging first, then production, then demo.

**Email outside production**: `lib/email/resend.ts` never mails real
addresses unless `VERCEL_ENV=production`. Elsewhere (staging, previews, local
dev) every message is redirected to `EMAIL_REDIRECT_TO` (cc dropped, subject
tagged `[STAGING -> <recipient>]`) or refused when that variable is unset;
batch sends (broadcasts) are also capped to a few samples there. Never set
`EMAIL_REDIRECT_TO` on Production.

Demo behaviour lives behind the `DEMO_MODE` flag (the `demo-login` provider in
`auth.ts`, the banner in `components/demo-banner.tsx`, the email short-circuit in
`lib/email/resend.ts`) — it is **not** a separate branch. A merge to `main`
rebuilds both deployments. Schema changes must be applied to **every**
database (staging, production, demo), and demo-only changes go in a separate
changelog section.

```bash
npm run db:seed:demo   # reseed the demo DB (reads .env.demo.local)
```

See [`docs/operating-two-environments.md`](./docs/operating-two-environments.md)
for the full model: env matrix, staging setup, migration steps, promotion
checklist, changelog split, and link privacy (gas.portamoneta.org and the
staging URL are private; only the demo URL is for public use).

## Documentation conventions

The repository is public and used as a portfolio piece. Keep contributor-
and visitor-facing docs in English; only UI strings that the cooperative's
members actually read should be in Italian.

Outside contributors start from [`CONTRIBUTING.md`](./CONTRIBUTING.md) (with
`SECURITY.md`, `CODE_OF_CONDUCT.md`, the issue forms in `.github/ISSUE_TEMPLATE/`
and the default `.github/pull_request_template.md`); keep its ground rules in
step with this file when a convention changes.

- **Code, identifiers, comments, JSDoc, commit messages, PR descriptions**:
  English only.
- **UI strings** (toasts, button labels, page copy, notification bodies):
  Italian — these reach real Italian-speaking users.
- **Two changelogs**: [`CHANGELOG.md`](./CHANGELOG.md) (English) and
  [`CHANGELOG.it.md`](./CHANGELOG.it.md) (Italian) follow the
  [Keep a Changelog](https://keepachangelog.com/) format and loose SemVer.
  They live at the repo root (the Next.js app root) so they are part of the
  Vercel deploy artifact — the in-app `/changelog` page reads them at runtime.

### Updating the changelog

**Whenever you ship a user-visible change** (new feature, behaviour change,
bug fix, etc.) you must update **both** changelog files:

1. Add an entry under `## [Unreleased]` in `CHANGELOG.md` (English)
2. Add the **same** entry, translated, in the same place in `CHANGELOG.it.md`
3. The two files must stay structurally identical: same section headings,
   same version numbers, same dates, same number of bullets per section.
   Only the prose language differs.
4. Use the right section heading:
   - `### Added` / `### Aggiunte` — new features
   - `### Changed` / `### Modificato` — behaviour changes on existing features
   - `### Fixed` / `### Risolto` — bug fixes
   - `### Performance` / `### Performance` — speed/efficiency improvements
   - `### Removed` / `### Rimosso` — features deleted
   - `### Security` / `### Sicurezza` — vulnerability fixes
5. Write entries from the **user's** perspective, not the developer's.
   Explain what changes for the member or admin, not which file was edited.
6. House style, enforced by eye (the `/changelog` page renders it):
   - One **italic tagline** on its own line under the version heading, saying
     what the release is about. The parser reads it; `**bold**` is not a tagline.
   - Every bullet opens with a **topical** emoji (🔔 notifications, 🚚 shipping,
     🗄️ database, 📱 mobile, …) — not the section's own icon, which the chip
     already shows. Avoid three identical ones in a row.
   - Then a **bold headline**, then at most two lines. One bullet per coherent
     change; collapse micro-fixes instead of listing them. Migration names and
     env vars are fine, longer implementation detail belongs in the PR.

When cutting a release, move the `[Unreleased]` block to a new
`## [x.y.z] — YYYY-MM-DD` heading in both files (Italian dates are written out:
`20 luglio 2026`), add the matching link reference at the bottom, and bump
`package.json`. Verify the two files still parse in parallel before merging.

## Architecture

### Request Flow

```
Browser → Next.js Server Component (data fetch via queries.ts)
        → JSX response with Server Action handlers
User interaction → Server Action ("use server") → auth check → DB mutation → revalidatePath()
```

### Auth

- **Better Auth** (since Lotto C, `lib/auth/config.ts`; instance and `auth()` in `auth.ts`). The default way in is an **email link**: the member types their address, Better Auth answers every request the same ("check your inbox", no enumeration), and `sendMagicLink` decides which email goes out (`lib/auth/email-kind.ts`): a link to a member or to a card holder, an explanation to anyone else (not a member, account deactivated, card lapsed, card check unavailable). Links last 15 minutes, work once, are stored hashed; 3 requests a minute per IP (`x-vercel-forwarded-for`). The emailed link opens `/login/conferma` (a button, a form GET to the verify endpoint), because mail scanners open links. The same email carries a 6-digit code (Better Auth `emailOTP`, issued in `sendMagicLink` through the server-only `createVerificationOTP`, so it goes only to addresses the admission let in; only an address's latest code works, 3 tries, 15 minutes, stored hashed) that the login form posts to `/sign-in/email-otp`: an installed app on iOS does not share Safari's cookies, so a link would sign the member into Safari. A `hooks.before` reruns the admission when a code is typed; the plugin's own send/check endpoints stay closed.
- **Google** is optional: on only with `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET` (redirect URI `<app>/api/auth/callback/google`, as before). Its tokens and profile picture are never kept.
- **Who gets in** (`lib/auth/admission.ts`, decisions in `lib/membership/policy.ts`), checked before a link goes out, on every Google sign-in (`user.validateUserInfo`), and when any session is created (`databaseHooks.session.create.before`: only for an active member, provisioned there for a card holder):
  - active member (email or alias) → in; deactivated → denied;
  - **membership-card check (optional):** with `WALLYFOR_API_KEY` + `WALLYFOR_MERCHANT_ID` (Porta Moneta: merchant `5082`), non-admins are checked against WallyFor: valid → in (recorded in `members.membership_status`), lapsed → `MembershipInactive`, API error → in (fail open);
  - unknown address → with the card check, a valid card provisions an active `utenti` member (audit `auto_provision_member`), invalid → `NotMember`, API error → `MembershipCheckUnavailable` (fail closed); without it → `NotMember`. Google identities whose email Google has not verified are never provisioned.
  - `saveOrder` rechecks non-admins when the last valid check is older than 24h, as before.
- Sessions live in `auth_sessions` (30 days, no IP or browser kept; migration 0022). Tables are prefixed `auth_`; an auth user is a sign-in identity (an address), not a member: `auth()` finds the member by email or alias **on every request** and returns no session for a member deactivated or deleted since, so they are signed out at once. `members.last_login_at` is set at each new session and shown in Soci.
- **Admin → Soci → Invita** emails a member the same link with a welcome text (`adminInviteMember`, `metadata.invite`): the onboarding of groups without the card check.
- Demo (`DEMO_MODE=true`) and local development (`AUTH_DEV_LOGIN_EMAIL`, never in production) sign in through their own endpoints (`lib/auth/plugins.ts`); the session hook still requires an active member.
- HTTP: only the endpoints in `lib/auth/public-endpoints.ts` answer (email link request and verify, sign-in with the code; Google's two where configured; demo and dev where enabled); everything else is a 404. Hosts accepted and used in links (`lib/auth/hosts.ts`): `APP_BASE_URL`, Vercel's production URL, a preview's own URLs, localhost under `next dev`.
- `proxy.ts` (Next.js 16's renamed middleware, Node runtime) only checks that the session cookie exists (no database); pages and actions check the session: `requireUserSession()` (redirect to `/login`), `requireAdmin()` / `requireActiveMember()` (`lib/auth/session.ts`, the only Server Action guards; `ActionError` otherwise). The admin page applies `checkAccess` (`lib/auth/access.ts`) and redirects non-admins home.
- Denials land on `/login?error=<code>`; the login page explains each code and links `brand.supportEmail` and `brand.privacyUrl`.
- `better-auth` is pinned to an exact version; upgrades run `lib/auth/config.int.test.ts` first.
- Abuse limits: 3 link requests a minute per IP (Better Auth, keyed on `x-vercel-forwarded-for`: outside Vercel every request shares one bucket), plus caps on the emails one address receives (`lib/auth/email-caps.ts`: 5 links an hour, 1 explanation a day, 50 explanations a day overall). The decision and the send run after the response (`defer: after`), so a member's request takes as long as a stranger's.
- A Google identity whose address Google has not verified is refused, member or not (`lib/auth/identity.ts`). Changing a member's email or alias, or deleting the member, deletes the sign-in identities (and sessions) of the addresses they no longer have.
- Known limits, not handled yet: a link forwarded by its requester signs the receiver into the requester's account (the confirmation page does not show the address); `auth_rate_limits` and unclicked `auth_verifications` rows are not purged; the token sits in the confirmation page's URL until used.

### Notifications

- Table `notifications`: `member_id | role | type | title | body | href | read_at | created_at`
- Notification types emitted by `admin.ts` / the cron route:
  - `order_closed` — cycle closure
  - `topup_received` — admin records a topup (or a Stripe top-up/refund lands)
  - `payout_sent` (category `wallet_topup`), `manual_charge_recorded` and `membership_fee_charged` (category `order_charge`) — admin records an outgoing movement in Cassa
  - `refund_failed` (category `wallet_topup`) — a Stripe refund failed after being accepted: the member and every active admin
  - `order_corrected` — admin edits a member's order via `adminEditClosedOrder`
  - `order_adjusted` — closed-cycle shipping recompute (only members whose share moved) OR per-line "actual delivered" rectification
  - `cycle_opened` — a cycle is created (always created already-open, so this is the single emit point, in `adminCreateCycle`)
  - `cycle_closing_reminder` — **retired in v1.9.0.** No longer emitted. Rows sent while the feature existed remain in members' inboxes and fall through `categoryForType` to the unknown-type branch: rendered in-app, never emailed. Do not reintroduce the name for something else.
- **All emission goes through `lib/notifications/dispatch.ts`** (`dispatchNotification` for single members, `dispatchWithBodies` for per-member bodies like cycle close, `dispatchToMembers` for broadcasts). Never insert into `notifications` directly — dispatch is where channel preferences are honoured.
- **Preferences** (`notification_preferences`, sparse: absent row = code default). Categories + defaults live in `lib/notifications/categories.ts`: `cycle_opened`, `order_charge`, `order_updates`, `wallet_topup`: app on, email off by default (since 1.17.0 also `cycle_opened`, to save the email quota for sign-in links; saved preferences are kept). The keys are stable (saved preferences key on them) but the member-facing voices are named for what they cover: `cycle_opened` "Nuovo ciclo aperto", `order_charge` "Addebiti e pagamenti" (`order_closed`, `settlement_due`, `order_paid`, `balance_paid`, `manual_charge_recorded`, `membership_fee_charged`), `order_updates` "Modifiche all'ordine" (`order_adjusted`, `order_corrected`, `cycle_cancelled`), `wallet_topup` "Saldo e rimborsi" (`topup_received`, `payout_sent`, `order_refund_sent`, `refund_failed`). A new type goes under the voice whose hint it fits, and the hint in `lib/i18n/it.ts`/`en.ts` is updated with it. Members edit them at `/profilo/notifiche` (Profile, or bell → ⚙; the old `/notifiche/impostazioni` redirects) via `updateNotificationPreference`. Raw `type` values are unchanged in the DB; `categoryForType` maps them (unknown type → in-app only, never email). Stored rows for retired categories are ignored by `resolvePreferences`, so removing a category needs no data migration.
- **Cycle-open audience** is gated by `canAccessCycle(accessLevel, role)` (an admin-only cycle only notifies admins); balance-change notifications (charge/updates/top-up) are personal.
- **No cron.** The app has no scheduled server work: the only `api/` route is `api/auth`. The closing-reminder cron was removed in v1.9.0 — GitHub executed 13% of its `*/15` schedule, so a reminder that had to fire inside a window was never reliable, and the feature was not worth the machinery. If a future feature needs scheduling, decide the mechanism first (Vercel Cron needs a paid plan for sub-daily; the account is Hobby).
- `AppShell` fetches `getUnreadNotificationCount(memberId)` and passes it to `NotificationBell`
- Bell in header → `/notifiche` page → `markNotificationRead` / `markAllNotificationsRead` Server Actions

### Role System

One vocabulary for both `members.role` and `order_cycles.access_level`
(the minimum role that can see, order in and be notified about a cycle),
all in `lib/roles.ts`:

| Value | As a role (UI label) | As a cycle access level (UI label) |
|---|---|---|
| `admin` | "Admin": admin panel, every cycle | "Solo admin": admins only |
| `attivi` | "Attivi" (active members) | "Attivi": attivi + admin |
| `utenti` | "Utenti" (default, auto-provisioning) | "Utenti (tutti)": everyone, the default for new cycles |

- Always go through `normalizeRole` / `normalizeAccessLevel` /
  `canAccessCycle` / `getRoleLabel` / `getAccessLabel`; never compare raw
  strings other than `role === "admin"`. Admin actions reject unknown values.
- Pre-0015 values are still mapped for the rollout (roles `socio` → `utenti`,
  `attivo`/`member` → `attivi`; levels `all` → `utenti`, `soci`/`member` →
  `attivi`). Migration 0015 rewrites them and adds CHECK constraints, so it
  must be applied **after** deploying the code that ships with it.

### Data Model (Neon Postgres, Drizzle ORM)

| Table | Purpose |
|---|---|
| `members` | User registry; `role`: admin / attivi / utenti; `merged_into` on an account absorbed by a merge (see Member merge); `household_of` on a person who joined a family (see Families); `welcome_dismissed_at` when the person closed the welcome card on Home (migration 0031, `lib/guide/welcome.ts`; `/?benvenuto=1` shows it again) |
| `order_cycles` | Weekly order windows; one `open` at a time |
| `products` | Per-cycle product list |
| `orders` | Order lines per member per cycle |
| `ledger_entries` | Balance: `topup` (+), `order_charge` (−), `shipping_charge` (−), `correction` (±), `payout` / `manual_charge` / `membership_fee` (−, Cassa, reason required), `refund_failed` (+, a Stripe refund that did not go through), `member_merge` (±, a pair with `counterpart`, see Member merge, never editable), legacy `adjustment`. Manual rows carry `method` (bonifico/contanti/satispay/altro) and `external_ref` (CRO/TRN, unique on `upper(trim())`, migration 0018). Rows of a refund carry `refund_id` (unique with `type`) |
| `orders.actual_quantity` / `actual_line_total` | Recorded after delivery when the supplier weighed something different from what was ordered (e.g. 1 kg → 800 g). NULL = delivered as ordered. |
| `notifications` | Per-member or per-role messages with `read_at` |
| `payments` | Online top-ups (Stripe Checkout): `status` pending → succeeded / failed / expired → partially_refunded / refunded, amounts in integer cents; `refunded_cents` = sum of its `pending` / `succeeded` refunds |
| `refunds` | Stripe refunds, one row each (`ref_*`): `status` requested → pending / succeeded → failed / canceled, `reason` (only `dashboard` until the app starts refunds), `stripe_refund_id`. Written only by `upsertStripeRefund` (`lib/payments/refund-store.ts`). Pre-1.15.0 refunds were imported by migration 0020 (`created_by = 'import'`, no Stripe id until an event names them) |
| `app_settings` | Payment settings from admin → Impostazioni, one row (`id = 1`): `payment_mode` (`wallet` | `per_order`, changed only by `adminChangePaymentMode`), `min_balance` / `max_balance`, bank transfer on/off with holder and IBAN, online payments on/off, `families_enabled`, `group_info` ("Il nostro gruppo" at the top of `/guida`, migration 0030, `lib/guide/group-info.ts`), `bank_reference_template` / `bank_receipt_email` (the bank transfer reference of each order paid by bank transfer, shown with Copy on `/ricarica` and in Storico, and the receipt address; migration 0033, `lib/payments/bank-reference.ts`, `order-reference.ts`). No row = brand defaults. Read only through `getPaymentSettings` (`lib/payments/get-settings.ts`) |
| `order_drafts` | A member's unconfirmed edits on an open cycle (`member_id`, `cycle_id`, `lines` jsonb), autosaved by the order form; `saveOrder` and the cycle close delete them in their batch |
| `order_cycles.payment_mode` / `handling_fee_*`, `payments.kind` / `cycle_id` / `order_snapshot` | Pay-per-order (`drizzle/0021_pay_per_order.sql`): see Online top-ups (Stripe). Ledger types `order_payment` (+) and `order_refund` (−) sit on the cycle. `order_cycles.settled_at` and `members.pays_offline` (`drizzle/0024_settlement.sql`): see Pay-per-order |
| `audit_log` | Append-only admin action log |
| `guide_search_misses` | Guide searches with no results, counted with no member id (migration 0032): `query` normalized by `missQuery` (`lib/guide/search-misses.ts`, which drops addresses, long numbers and sentences), `count`, `last_at`; pruned after 90 days, listed in admin → Impostazioni |
| `suppliers` | Supplier registry |
| `supplier_products` | Supplier product catalog (source for cycle products) |

ID prefix convention: `cyc_*`, `mem_*`, `prd_*`, `ord_*`, `led_*`, `not_*`, `aud_*`, `sup_*`, `spr_*`, `pay_*`, `ref_*`.

### Key Business Rules

- Closing a cycle auto-generates `order_charge` ledger entries + `order_closed` notifications for every member with orders.
- Member balance = `SUM(ledger_entries.amount)` for that member.
- Negative balance is allowed — UI warns — down to the optional credit limit:
  the minimum balance of the payment settings (`getPaymentSettings`; before an
  admin saves, `brand.minBalance`; null = no limit; Porta Moneta: -50).
  `saveOrder` refuses a save when balance − uncharged orders on other open
  cycles − the new total would fall below it (saves that do not raise the
  cycle's total always pass). The check runs before the write batch, so
  concurrent saves can overshoot it.
- **Maximum balance** (payment settings, optional): online top-ups stop there
  (`topupCeilingCents`, rechecked in `startOnlineTopup`; a soft limit, two
  checkouts opened together can overshoot it). The bank details stay visible
  with how much still fits; a Cassa top-up is never refused, the admin gets a
  notice and Cassa filters "above max". A member in debt gets the exact debt
  as the first top-up amount.
- **Order drafts**: `/ordine` autosaves the form (`saveOrderDraft`, 800 ms
  debounce, guarded by the cycle row `FOR SHARE` so no draft lands after the
  close or the deadline). A draft equal to the confirmed order is deleted;
  `saveOrder` and `performCycleClose` delete drafts in their batch.
- **Server Actions return expected refusals as values, never throw them**:
  Next.js masks thrown Server Action messages in production. Internally a
  refusal is an `ActionError` (`lib/action-error.ts`, also thrown by the
  guards); each exported action converts it at the boundary with
  `actionErrorMessage(e, fallback, action)`, which rethrows `redirect()` /
  `notFound()` (`unstable_rethrow`), passes an `ActionError` message through
  and logs anything else, returning the generic fallback. `saveOrder` returns
  `{ success: false, error, code }` (`SaveOrderErrorCode`, e.g.
  `cycle_not_open`, which the order form uses to refresh); admin actions
  return `{ error }` next to their data.
- Products loaded from semicolon-delimited text: `Name;Variant;Format;Price;Supplier;Notes`.
- Email is the unique member identifier (login key). Alias email supported for non-Google accounts.
  Emails and aliases share one case-insensitive namespace: unique indexes on
  `lower(email)` / `lower(alias_email)` (migration 0017) plus the email-vs-alias
  cross-check in `adminUpsertMember`; `normalizeEmail` (`lib/member-email.ts`)
  is the one normalizer for storing and comparing.

### Member merge

One person, two accounts (typically an old address and the one they used at first sign-in): Admin → Soci → **Unisci**, or the prompt that appears when an admin types another member's address in ✎. Rules in `lib/members/merge.ts` (pure, unit tested), write in `lib/members/merge-store.ts` (one guarded batch: both member rows locked `FOR UPDATE`, the moving cycles locked and still open, a fingerprint of everything the plan read compared again; a change meanwhile aborts with "retry"), actions in `lib/actions/admin-members.ts` (`previewMemberMerge`, `adminMergeMembers`).

- The survivor keeps name, role, primary email, preferences; its secondary email becomes the absorbed account's primary by default (one slot: the admin picks, the addresses nobody keeps lose their sign-in identities). Sessions continue: `auth()` resolves the address to the survivor on the next request.
- Orders on open cycles, drafts and notifications move. Closed-cycle orders stay with their charges (`closed_cycle_charge` pairs them). The balance moves as a `member_merge` pair (`ledger_entries.counterpart`, migration 0027): no ledger row changes member.
- Refused: both ordered on the same open cycle, an open pay-per-order cycle, a pending payment or refund, an unsettled pay-per-order cycle with movements, absorbing your own account.
- **Possible duplicates** (`lib/members/duplicates.ts`, pure): active, unmerged pairs with the same name (accents, case and word order ignored, 2+ words) or whose name words (3+ letters, at least two) appear in the other's address; the proposed survivor is the higher role, then the older account. Shown on top of Soci with Merge prefilled; "not the same person" stores the pair in `member_duplicate_dismissals` (migration 0028, cascades on member delete). Typical cause: an old address with no card is refused (`MembershipInactive`), the member signs in with the card's address and the card check provisions a second account; the login message tells them to do exactly that, and the admin merges.
- An absorbed account with no history is deleted; otherwise it stays inactive with `merged_into`, a `<memberId>@merged.invalid` address and a zero balance. Nightly checks `member_merge_pairs` and `merged_member_empty`.

### Families

People who shop together share one account (cart, balance, history) while each keeps their own member row, addresses, name, role and card. Off by default: `app_settings.families_enabled` (admin → Impostazioni). Migration `0029_families.sql`: `members.household_of` (the account a person joined), `family_invites` (pending → accepted / declined / cancelled, 7 days, one pending per pair). Rules in `lib/members/family.ts` (pure: `checkInvite`, `checkUnlink`, `familyRole`, `sessionAccount`, at most 6 people), actions in `lib/actions/family.ts`, page `/famiglia` (linked from the Profile, `/profilo`).

- **Session**: `auth()` resolves the address to the person, then serves the account: `memberId` = the account, `personId` = who signed in. Role: the admin panel is personal (`requireAdmin` returns the person as `memberId`), cycle access is the higher of person and account. A deactivated account signs its people out.
- **Joining** reuses the merge in mode `link` (`mergeMembers`, guarded on the invitation still pending): balance as a `member_merge` pair, open-cycle orders and drafts move, the person stays active with their own notifications (`notificationOwners` shows both). Same refusals as a merge. **Leaving** (the person) or **removing** (the account's own person, or an admin in Soci) only clears `household_of`: the money stays with the family.
- Storico shows the history of every person in the account (`getFamilyMemberIds`); the card check on an order passes with any card in the family; `cycle_opened` and Cassa skip linked people (Cassa names the account with its people and refuses a movement on a linked person). Invitations: in-app `family_invite` plus an email to the primary address whatever the preferences.
- Nightly check `household_member_empty`: a linked person has a zero balance and no open-cycle order or draft. Known limit: a correction on a closed order from before joining posts to the person and trips it; unlink, correct, rejoin (or correct on the account).

### Post-closure adjustments

The admin has four independent ways to correct a closed cycle:

1. **Edit cycle metadata** (`adminUpdateCycle` on a `status='closed'` cycle) — change title/notes/pickup dates/supplier freely; changing shipping mode or amount **recomputes `shipping_charge` ledger entries in place** on the members' effective totals (`coalesce(actual_line_total, line_total)`, `planShippingRecompute` in `lib/shipping.ts`), reversing to 0 a member left without an order, and emits `order_adjusted` only to members whose share moved. `orderCloseAt` and `accessLevel` are locked (supplier stays editable post-closure since a cycle can close before one was ever set — that's the only way to unblock the "Fornitore" send/import actions on it). UI: ✎ Modifica button in admin → Ultimi cicli.
2. **Edit a member's whole order** (`adminEditClosedOrder`) — change integer quantities, add or remove products, or create an order from scratch for a member who didn't originally participate. Posts a single `correction` ledger entry with the delta vs the original total. Original `order_charge` row is left intact. Unless the cycle is `manual`, the shipping is re-split in the same guarded batch (the edited member's shipping change is folded into their `order_corrected` notification; other movers get `order_adjusted`). UI: ✎ Modifica button on each member row inside Recap ordini.
3. **Record actual delivered weight/cost per line** (`adminUpdateOrderLineActuals`) — for the case where 1 kg of beetroot weighed 800 g. Writes the actuals to `orders.actual_quantity` / `orders.actual_line_total` and posts a `correction` ledger entry with the delta. Composes with #2 because both use the same correction-ledger model. UI: click any order line inside Recap ordini.
4. **Import a supplier-filled distinta (`.xlsx`)** (`adminApplyDistintaImport`) — round-trip flow: Admin → Ciclo → Fornitore (`components/admin/supplier-steps.tsx`, steps 1-2) sends an Excel sheet built by `lib/csv/distinta-builder.ts` (products × members matrix with formulas + locked refs + hidden `_meta` sheet carrying cycleId/productId/memberId). The supplier overwrites the yellow cells after weighing, sends the file back, the admin uploads it in step 3. The parser (`lib/csv/distinta-parser.ts`) shows a diff preview; on apply, every product correction goes through `adminUpdateOrderLineActuals` (#3 above), while the shipping row writes `shipping_charge` ledger entries directly per member and flips `orderCycles.shippingMode` to **`"manual"`**. The `manual` sentinel causes `recomputeShippingForClosedCycle` to early-return, so a later admin edit to the shipping field won't overwrite the per-member values (the cycle form shows an orange banner instead of the shipping inputs).

All four emit `order_adjusted` or `order_corrected` notifications and `audit_log` entries. Admin → Ciclo → Conti (`components/admin/cycle-accounts-view.tsx`) lists what they left on the ledger, read only through `liveLedger` (`getCycleLedgerRows`, summarized by `lib/admin/cycle-money.ts`).

### Online top-ups (Stripe)

- Optional per deploy (`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`) and
  switchable in admin → Impostazioni: `/ricarica` offers online top-ups only
  when both hold, and the bank details only when that channel is on (holder
  and IBAN from the settings, `brand.bankTransfer` until an admin saves; with
  no channel at all, an "ask the treasurer" line). `resolveStripeKey`
  (`lib/payments/config.ts`) accepts live keys only on a real production deploy
  and test keys everywhere else, demo included. A restricted key (`rk_*`)
  needs Checkout Sessions: Write, PaymentIntents: Read and, since 1.15.0,
  Refunds: Read (`charge.refunded` re-lists the charge's refunds); without it
  every `charge.refunded` answers 500.
- Flow: `startOnlineTopup` (`lib/actions/topup.ts`) validates the amount
  (0,50-300 €; 0,50 is Stripe's EUR minimum charge), inserts a `pending` payment and opens a hosted Checkout Session
  (idempotency key = paymentId, 30 min expiry) whose success/cancel URLs point
  back at the deploy the member is on. `/ricarica` only displays the payment
  row's status; **only the signed webhook credits**.
- Webhook `app/api/stripe/webhook/route.ts`, excluded from the auth
  proxy, verifies the signature on the raw body and rejects events whose
  `livemode` differs from the key's. `lib/payments/webhook.ts` maps events
  (`planWebhookAction`, pure) and applies each as ONE SQL statement: a guarded
  `UPDATE payments ... WHERE status = 'pending'` feeding the ledger `INSERT`,
  so a replayed or concurrent event writes nothing. An amount/currency
  mismatch is not credited: it is logged and audited as `stripe_topup_mismatch`.
- **Refunds** (table `refunds`, since 1.15.0): one idempotent entry point,
  `upsertStripeRefund` (`lib/payments/refund-store.ts`), fed by the
  `refund.created` / `refund.updated` / `refund.failed` events and by
  `charge.refunded`, which re-lists the charge's refunds as a safety net. It
  finds the row by Stripe id, then by `metadata.refundId`, then adopts an
  imported pre-1.15.0 row of the same payment and amount; otherwise it
  creates one (`reason = 'dashboard'`). Transitions are pure
  (`planRefundTransition`, `lib/payments/refunds.ts`) and written as one
  guarded statement: the first `pending` / `succeeded` posts the negative
  `correction`, a `failed` / `canceled` after that posts `refund_failed` (+)
  and notifies the member and every admin (return it by bank transfer), and
  `payments.refunded_cents` moves with the ledger row. A refund that arrives
  before its credit answers 500 so Stripe retries it. The endpoint must
  subscribe to the three `refund.*` events: without them `charge.refunded`
  still records refunds, but not their failures.
- **Pay-per-order:** with `app_settings.payment_mode = 'per_order'` a cycle created then keeps `order_cycles.payment_mode = 'per_order'` for life and carries a handling fee (`handling_fee_type` percent | fixed, `handling_fee_value`, default the last cycle's, 10% the first time). The member confirms by paying: `startOrderPayment` (`lib/actions/order-payment.ts`) prices the lines from the DB, computes products + fixed shipping + fee minus what the cycle's payments already cover (`orderPaymentAmount`, `lib/payments/order-payment.ts`; below 0,50 € it charges 0,50, above 1.000 € it refuses), and either confirms at once (`confirmOrderWithoutPayment`, guarded on the coverage) or expires the member's open Checkouts on the cycle and opens a new one (`payments.kind = 'order'`, `cycle_id`, `order_snapshot`). The webhook (`applyOrderCredit`, `lib/payments/order-credit.ts`) writes the order from the snapshot and credits `order_payment` (+) in one batch that locks the cycle like the close; if the cycle closed or a paid product left it, the payment is credited and refunded in full (`late_<paymentId>`). `cancelOrder` deletes the order and asks for `cancel_<paymentId>` refunds. App-requested refunds are rows in `requested`, sent by `sendRequestedRefund` (`lib/payments/refund-request.ts`) with the refund id as idempotency key; an unreachable Stripe leaves them `requested` and Cassa offers "Retry the refunds". `saveOrder` and `startOnlineTopup` refuse on pay-per-order, except `saveOrder` for a member with `pays_offline` (no balance limits; Cassa records the money).
- **Card cycles in a wallet group:** the group's mode is the default of a new cycle; a wallet group may also create a single `per_order` cycle (`resolveNewCycleMode` / `cardCyclesSelectable`, `lib/payments/cycle-mode.ts`: a usable Stripe key and EUR, online top-ups may stay off). Every per-cycle rule above applies; checks read `cycle.paymentMode`, never the group's mode, except the amount-due block in `startOrderPayment` (per_order groups only). The wallet balance members see and spend is `getWalletBalance` (`lib/payments/balance-due.ts`): the consolidated balance, so card money on a cycle not settled stays out of it (plain sum for `pays_offline`); card cycles' orders are left out of the credit limit's pending orders. After the settlement what is left (a credit or a debt) joins the wallet. Admin lists (Cassa, Soci) still show the plain sum.
- **Settlement (Chiudi i conti):** `lib/payments/settlement.ts` (pure plan per member: card refunds newest payment first, amount due from 0,50 €, write-off below, offline members left out) and `settlement-store.ts` (`previewSettlement`, `settleCycle`: one guarded batch with `settle_<pid>_<n>` refund requests, write-offs and `settled_at`, then the Stripe calls within 240 s; rerunning is safe; `getSettlementStatus` for Admin → Ciclo). Money beyond the card payments is given back in Cassa, outside the cycle.
- **Amount due (Da saldare):** the consolidated balance (`lib/payments/balance-due.ts`) leaves out per_order cycles running or not settled. Below −0,50 € Home and `/ricarica` show "Paga ora": `startBalancePayment` (`lib/actions/balance-payment.ts`) opens a `kind = 'balance'` Checkout whose `order_snapshot.parts` splits the amount over the settled cycles that owe, oldest first, the rest outside cycles; the webhook (`applyBalanceCredit`) books one `balance_payment` (+) per part. `startOrderPayment` refuses a new payment while an amount is due.
- **Mode switch:** `adminChangePaymentMode` (`lib/actions/admin-settings.ts`, rules in `lib/payments/mode-change.ts`): no cycle running, every per_order cycle with money settled, pay-per-order only in EUR with a usable Stripe key; one guarded batch with an audit holding the balances.
- Ledger rows with a `payment_id` cannot be edited or deleted from Cassa (they show as online; `method` stays NULL).
- Staging (Vercel Authentication on): the Stripe sandbox endpoint URL needs
  `?x-vercel-protection-bypass=<Protection Bypass for Automation secret>`.
- Disputes are not handled automatically yet: Stripe emails the account owner,
  the admin records a `correction` by hand.

### Email (Resend)

- Sending the closed-cycle order to the supplier (`adminSendSupplierEmail`) uses Resend. The acting admin **and `gas@portamoneta.org`** (shared GAS archive) are always in CC.
- Env vars: `RESEND_API_KEY`, `MAIL_FROM`. Without them the button toasts the missing-config error and the rest of the app keeps working.
- Modules: `lib/email/resend.ts` (thin SDK wrapper, lazy env read), `lib/email/templates.ts` (Italian body), `lib/csv/distinta-builder.ts` (round-trip `.xlsx` distinta — products × members matrix with formulas, hidden `_meta` for re-import), `lib/csv/distinta-parser.ts` (reads the supplier-filled file, returns a diff preview). `lib/csv/supplier-export.ts` is kept as a legacy per-product CSV but no longer the default attachment.
- Resend SDK detail: the `content` field on attachments base64-decodes strings — always pass a `Buffer`.
- **Notification emails** reuse the same wrapper. `sendMailBatch` (in `resend.ts`) sends up to 100 one-off messages per Resend `batch.send` call (chunked internally) — used for cycle-close and broadcasts to sidestep the 2 req/s limit. `notificationEmail` (in `templates.ts`) wraps a notification's already-localized title/body with a CTA + a manage-preferences link; links need a base URL from `lib/email/base-url.ts` (`APP_BASE_URL`, falling back to `VERCEL_PROJECT_PRODUCTION_URL`; links omitted if neither is set). All notification email is fire-and-forget — a send failure is logged, never rolled back onto the caller's DB work — and `DEMO_MODE` blocks it like every other send.
- Env var added for notifications: `APP_BASE_URL` (email links). See `.env.example`. `CRON_SECRET` went away with the reminder cron in v1.9.0; the GitHub repo secret and the Vercel env var are leftovers that can be deleted from both dashboards.
- **Email compliance**: these are low-volume service messages to a small private group, so the manage-preferences link in the footer is the opt-out; we intentionally do **not** set a `List-Unsubscribe` header. Revisit if the audience ever grows or messages become promotional.

### Database environments & access (since 2026-07-10)

- **Local dev runs on the Neon branch `dev`** (project `porta-moneta-app-gas`,
  a copy-on-write child of `production`): `.env.local`'s `DATABASE_URL` points
  there. The prod connection string lives ONLY in `.env.prod.local`, reserved
  for migrations the user explicitly confirmed. Never point local dev at prod.
- **Agent access**: Neon MCP (registered in `.mcp.json`, OAuth on first use)
  or `neonctl` (machine-wide OAuth token). Agents operate autonomously on
  non-prod branches; anything touching `production` needs Federico's explicit
  per-operation confirmation.
- **Refresh dev data on demand** (resets the branch to current prod — destroys
  any test data on `dev`):
  `npx -y neonctl branches reset dev --parent --project-id small-breeze-14972344 --org-id org-gentle-violet-55538692`
- **Vercel Preview deployments use the `dev` Neon branch** (since 2026-07-11:
  `DATABASE_URL` has two entries on the porta-moneta project — Preview → dev
  branch, Production → prod). PR previews share the dev branch with local dev;
  both are throwaway (reset on demand). The `staging` branch deployment uses
  `dev` too (the B2.1 Stripe check on staging wrote to it), so apply a
  migration to `dev` before merging to `staging`. A per-PR Neon branch
  integration would be a further upgrade, not required.
- **Migrations** (since 2026-07-11, issue #85): `scripts/db-migrate.mjs` tracks
  applied files in a `_migrations` table — the ledger is baselined on prod,
  demo and dev. Flow for a schema change: write the next `drizzle/NNNN_*.sql`
  (additive, idempotent), then run `npm run db:migrate` per environment
  (defaults to `.env.local` = dev branch; target another DB with
  `DATABASE_URL=… node scripts/db-migrate.mjs`). `--status` lists
  applied/pending, `--baseline` records without executing. This replaces the
  one-off-script convention; `db:push` remains for local schema iteration only.
- **No real data in the repo, and DB-writing scripts refuse prod by default.**
  The repository is public: never commit one-off scripts, fixtures or seeds
  that contain real members' names, emails or balances (the 2026 one-off
  `scripts/reconcile-balances.mjs` was removed for this reason; its history
  is not rewritten). Keep such scripts outside the repo or read the data from
  a local, git-ignored file. Any new script that writes to the database must
  compare `new URL(process.env.DATABASE_URL).host` with the production host
  and exit unless an explicit flag (e.g. `--allow-prod`) is passed, so a
  mis-pointed `.env` cannot mutate production silently. Existing scripts:
  `seed-demo.ts` refuses to run without `DEMO_MODE=true` (prod never sets
  it); `db-migrate.mjs` targets production on purpose at promotion time and
  has no such flag yet (open follow-up), so run it only with the connection
  string typed explicitly on the command line.
- **Integration tests against a real DB** (recipe, not wired into CI): create
  a throwaway Neon branch, point the test run at it, delete it after —
  `npx -y neonctl branches create --name test-x --parent production --project-id small-breeze-14972344 --org-id org-gentle-violet-55538692`
  then `npx -y neonctl branches delete test-x …`. Cheap (copy-on-write) and
  safe; the vitest suite itself stays pure by design.

### Production database access

- **`vercel env pull` returns an empty string for `DATABASE_URL`, `AUTH_SECRET`,
  `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.** These are marked *Sensitive* in the
  Vercel project (not just *Encrypted*), and Sensitive values are unreadable
  via CLI/API/dashboard after creation, by Vercel's own design — this is not a
  permission problem to work around. Get the prod connection string from
  **console.neon.tech** → the right project → *Connection Details* instead.
- Both `porta-moneta` (prod) and `wegrocery-demo` live under the same Vercel
  team/scope already used by the local CLI login (`vercel project ls` lists
  both). `vercel link --project porta-moneta --yes` from a throwaway directory
  (not this repo checkout, to avoid leaving the working copy linked to prod)
  is enough if you need `vercel env ls` / non-Sensitive vars.
- For a **surgical prod schema change** (e.g. adding a constraint), prefer a
  small one-off script against `@neondatabase/serverless` with an explicit
  pre-flight check over `npm run db:push` — `db:push` diffs the *entire*
  schema against `schema.ts` and can pick up unintended drift on a DB you
  haven't touched in a while. Real example (2026-07-07,
  `drizzle/0008_unique_constraints.sql`): the pre-flight query in the
  migration's header found a genuine duplicate (two "Kiwi" products in one
  closed cycle, with real order lines attached) — resolved by merging the
  order lines onto the surviving product row and deleting the duplicate
  *before* creating the unique index. Never delete conflicting rows blindly;
  a pre-flight hit is an app-level bug worth understanding first.

### Backup & Restore

Neon free tier only retains 6 hours of point-in-time history (the Launch plan goes up to 7 days; see neon.com/pricing), so we ship a daily off-site backup to Google Drive.

**Workflow**: [`.github/workflows/backup.yml`](.github/workflows/backup.yml) runs every day at 03:00 UTC (also via `workflow_dispatch`). It `pg_dump`s the Neon production DB, gzips the result, and `rclone copy`s it to `gdrive:PortaMoneta/GAS-Backups/`. After a successful upload it prunes that folder's own `gas-backup-*.sql.gz` files older than **90 days** (`rclone delete --min-age 90d`, top level only, other files untouched; Drive keeps them in the trash).

**Required GitHub Secrets** (Settings → Secrets and variables → Actions):

| Secret | Value |
|---|---|
| `DATABASE_URL` | Neon production connection string (same as Vercel) |
| `RCLONE_CONFIG` | Full contents of local `~/.config/rclone/rclone.conf` after running `rclone config` (remote named `gdrive`) |
| `GDRIVE_BACKUP_PATH` | `gdrive:PortaMoneta/GAS-Backups` |

**Restore procedure.** **Never restore directly into production** — always do it on a throwaway Neon branch first, verify, then promote or selectively copy rows back.

```bash
# 1. Download gas-backup-YYYY-MM-DD.sql.gz from
#    Google Drive → IT & Processi → Porta Moneta App GAS → Backup_DB
gunzip gas-backup-YYYY-MM-DD.sql.gz   # produces gas-backup-YYYY-MM-DD.sql

# 2. In the Neon console (console.neon.tech):
#    Branches → "Create branch" → from main → name e.g. "restore-test"
#    → copy the new branch's "Connection string" (pooled is fine).
export RESTORE_URL='postgresql://…neon.tech/neondb?sslmode=require'

# 3. Wipe the branch's schema (it inherits prod data — we need a clean slate)
#    and load the dump:
psql "$RESTORE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
psql "$RESTORE_URL" -f gas-backup-YYYY-MM-DD.sql

# 4. Sanity check the restore:
psql "$RESTORE_URL" -c "
  SELECT 'members' AS t, count(*) FROM members
  UNION ALL SELECT 'order_cycles', count(*) FROM order_cycles
  UNION ALL SELECT 'orders', count(*) FROM orders
  UNION ALL SELECT 'ledger_entries', count(*) FROM ledger_entries;
"
```

Then choose your path:

- **Inspect only / look up a value** — query the branch, then delete it from the Neon console when done. Production is untouched.
- **Recover a few specific rows** — `pg_dump --data-only --table=public.<table> "$RESTORE_URL"` filtered by `--where`, then `psql "$PROD_URL"` to apply. Keeps production live.
- **Full production restore (catastrophic loss)** — in the Neon console, **Reset main from this branch** (or: rename main → main-broken, promote restore-test → main). Then update `DATABASE_URL` in Vercel only if the connection string changed. Stop Vercel traffic during the swap with a maintenance flag in `vercel.json` or by pausing the project.

`pg_dump` runs with `--no-owner --no-privileges --format=plain` so the dump is portable across Neon branches without role-name conflicts. The `\restrict` / `\unrestrict` directives at the top and bottom are PG 17 metadata — `psql` handles them transparently.

### Design System: role tokens

Brand colours come from the brand JSON (`theme`), never from the code.
`lib/brand/roles.ts` derives the CSS variables, `app/layout.tsx` sets them on
`<html>`, and `app/globals.css` maps them to Tailwind 4 `@theme` colours.
Defaults below are the WeGrocery palette (`DEFAULT_PALETTE`).

| Class suffix | Default | Use |
|---|---|---|
| `primary` | #F5A623 | Fills: CTA buttons, active dots, progress. Also borders and rings |
| `on-primary` | computed | Text on a `bg-primary` fill (near-black or white, whichever reads better) |
| `primary-text` | computed (#8E6014) | Primary-coloured **text** and links on light surfaces |
| `primary-soft` | #FEF3DC | Soft background (balance card) |
| `primary-mid` | primary at 30% | Borders on soft backgrounds |
| `accent`, `on-accent`, `accent-text`, `accent-soft` | #00A896 … | Same roles for the accent (open-cycle badge, top-ups) |
| `muted` | computed (#6B6B6B) | Secondary text |
| `brand-red` / `brand-red-light` | #C53030 / #FEECEC | Negative balance, errors, destructive buttons (white text) |
| `brand-near-black` | #2d2b29 | Primary text, dark buttons (white text) |
| `brand-gray` | #58595B | Secondary text |
| `brand-gray-light` | #ADADAD | Fills and disabled states only |
| `brand-warm-white` | #faf8f5 | App background |
| `brand-border` | rgba(88,89,91,0.10) | Borders |

Rules (enforced by `lib/brand/design-guard.test.ts`):
- Every text/background pair reaches WCAG AA (4.5:1). Computed tokens
  guarantee it for any palette; `brandContrastWarnings()` logs at startup
  when a palette cannot.
- Never `text-white` on `bg-primary` / `bg-accent`: use `text-on-primary` /
  `text-on-accent`. Keep the fill and its text colour on the same line.
- Coloured text is `text-primary-text` / `text-accent-text`, not `text-primary`
  (that is the fill colour; fine only on a dark background).
- No opacity modifier on a text token (`text-accent-text/80`): it undoes the
  computed contrast. Tints of a fill behind its own text go up to `/20`.
- Never `text-brand-gray-light`: use `text-muted`.
- No palette names (`orange`, `teal`) and no hard-coded brand hex.
- No text under 12px: `text-label` (12px) is the smallest size. On phones
  `input`, `select` and `textarea` are forced to 16px in `globals.css` (iOS
  zooms the page on smaller fields), so do not size fields below that.

Key patterns:
- **Saldo hero card**: primary-soft (positive) or red-light (negative), 70px balance amount
- **Pill steppers** in order form: zero-state (single + btn) vs has-qty state (−/qty/+)
- **Installable app (PWA)**: `app/manifest.ts` (public: `proxy.ts` lets `manifest.webmanifest` and `.png` through) lists icons drawn at build time from `brand.logoUrl` by `app/icons/[file]/route.tsx` (sizes in `lib/pwa/icons.ts`; a logo that cannot be loaded becomes a letter, never a failed build). `components/install-prompt.tsx` sits last on Home, phones only (`lib/pwa/install-hint.ts`); no service worker.
- **Navigation**: items from `nav-items.ts`, filtered by `visibleNavItems` (members 4, admins 5 with Admin). `BottomNav` up to `lg`, `TopNav` (in the header row) from `lg`; never both. An item's `also` paths keep it current on pages without an item (Ricarica → Home); the bell and the avatar carry `aria-current` on Notifiche and on Profilo/Famiglia
- **Notification bell**: in header, red badge with count, links to `/notifiche`
- **Gestures** (`lib/ui/use-swipe.ts`, Pointer Events, no library): drag down on a `Sheet`'s handle or header closes it on phones (`swipeToClose={false}` on the cycle-close review), a confirm's drag is "Annulla"; off with reduced motion, never from the left edge. `components/app-refresh.tsx` refreshes the page after 5 minutes in the background and shows the offline line; tapping the current bottom-bar item scrolls up and refreshes. Neither ever runs on `/ordine` (`lib/ui/refresh.ts`)
- Shell `max-w-[480px]`, `md:max-w-[640px]`, `lg:max-w-[960px]` on every page, centered; `bg-brand-frame` frames the app, and the card never resizes between pages. Inside it, `<AppShell layout="reading">` (the default) keeps a 600 px column from lg (Guida, Profilo, Notifiche, Changelog, Ricarica); `layout="wide"` uses the whole card (Home's two columns, Admin). Widths live in `shell-width.ts`, mirrored by `ShellSkeleton`
- Member pages: reading text is 14px, prices and notification bodies included (sans, `tabular-nums`); mono stays for small labels and totals
- Small header controls (bell, avatar, "?") keep their look and get a 44 px touch area with the `hit-44` utility
- The header holds the bell and the Profile avatar (initials, `lib/profile/summary.ts`); the email, sign-out and personal settings are on `/profilo`, whose rows hide what the deploy has not switched on

### Known Gotchas

- `AppShell` is an **async Server Component** (fetches unread notification count). Don't convert to Client Component.
- Every page that renders `AppShell` must pass `memberId={session.user.memberId!}`.
- All Server Actions use `requireUserSession()` / `requireAdmin()` — never trust client payloads for auth.
- `revalidatePath()` must be called after mutations so Server Components re-fetch fresh data.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
