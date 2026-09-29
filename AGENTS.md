# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WeGrocery** is an open-source, white-label web app for food co-ops and buying groups (born as the Porta Moneta GAS app, now its first client deployment). Members log in with Google, place weekly orders, and track their balance. Admins manage cycles, products, suppliers, and member topups. Branding/locale per deployment via `NEXT_PUBLIC_BRAND_JSON` (see `lib/brand` and `lib/i18n`).

**Stack**: Next.js 15 App Router · Postgres (Neon serverless) · Auth.js (Google OAuth) · Drizzle ORM · Tailwind CSS v4 · Vercel

**Live**: gas.portamoneta.org

## Codebase structure

```
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Home: saldo hero, ciclo aperto, ultimi movimenti
│   ├── ordine/page.tsx         # Order: confirmed recap (edit/cancel) or the stepper form
│   ├── storico/page.tsx        # Order history + ledger movements tabs
│   ├── notifiche/page.tsx      # Notification list with mark-as-read
│   ├── guida/page.tsx          # How-to steps + FAQ accordion
│   ├── admin/page.tsx          # Admin panel: 6 tabs (ciclo/prodotti/ordini/cassa/fornitori/soci)
│   ├── login/page.tsx          # Login with Google
│   └── api/auth/[...nextauth]/ # Auth.js route handler
├── components/
│   ├── app-shell.tsx           # Async layout wrapper: header (logo + bell + logout) + bottom nav
│   ├── bottom-nav.tsx          # 5-item bottom nav (home/ordine/storico/guida/admin)
│   ├── notification-bell.tsx   # Bell icon with red unread badge
│   ├── home/cycle-countdown.tsx
│   ├── admin/                  # Admin tab components (one per tab)
│   └── ui/                     # Button, Card, ConfirmDialog, Toast, FaqAccordion
├── lib/
│   ├── db/
│   │   ├── schema.ts           # Drizzle tables: members, order_cycles, products, orders,
│   │   │                       #   ledger_entries, notifications, audit_log, suppliers, supplier_products
│   │   ├── queries.ts          # All read queries + getUnreadNotificationCount
│   │   └── client.ts           # Neon connection (DATABASE_URL)
│   ├── actions/
│   │   ├── admin.ts            # Admin Server Actions: cycles, ledger, topup, members, suppliers,
│   │   │                       #   adminSendSupplierEmail, adminUpdateOrderLineActuals,
│   │   │                       #   adminEditClosedOrder
│   │   ├── admin-cycles.ts     # Cycle-specific actions
│   │   ├── admin-products.ts   # Product/catalog actions
│   │   ├── notifications.ts    # markNotificationRead, markAllNotificationsRead
│   │   └── order.ts            # saveOrder (member)
│   ├── email/                  # Resend wrapper + supplier-email templates
│   ├── csv/                    # Server-side CSV builders (e.g. supplier aggregated export)
│   └── auth/session.ts         # requireUserSession(), requireAdmin(), getUserRole()
├── middleware.ts                # Redirect unauthenticated to /login
├── auth.ts                     # Auth.js config (Google provider, member whitelist callback)
├── drizzle/                    # SQL migrations (0000–0007)
└── public/logo.png
```

## Development Commands

All commands from repo root:

```bash
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run db:push      # Push Drizzle schema to Neon (needs DATABASE_URL in .env.local)
npm run db:studio    # Drizzle Studio (visual DB browser)
```

**Deploy**: push to `main` → Vercel auto-deploys production. Development PRs target `staging` and are tested on its Preview deployment before `staging` → `main`; other branches create ordinary preview deployments.

**Vercel Root Directory**: repo root (empty / not set)

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
  it as a function. `sharp` is a safe override — Next.js still declares
  `^0.34.5` even on 16.2.12, so there is no upstream fix coming.
- **Confirm the fix landed** by comparing each alert's `first_patched_version`
  against the resolved tree, not by trusting the bump.
- **`next-auth` is pinned to an exact beta on purpose.** A caret on a
  prerelease accepts breaking betas, so it sits in Dependabot's `ignore` list
  and upgrades there are a deliberate decision.
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
  Preview + Git branch `staging`: `DATABASE_URL` → Neon branch `staging`
  (child of `production`, refreshed with
  `neonctl branches reset staging --parent`), `EMAIL_REDIRECT_TO`,
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

- Google OAuth via Auth.js. Only emails in the `members` table can log in,
  unless the membership-card check is configured (below).
- **Membership-card check (optional, per deploy).** With `WALLYFOR_API_KEY` +
  `WALLYFOR_MERCHANT_ID` set (Porta Moneta: merchant `5082`), the `signIn`
  callback checks Google sign-ins against WallyFor (`lib/membership/wallyfor.ts`,
  decisions in `lib/membership/policy.ts`):
  - active admin → in, no check; deactivated member → denied (admin
    deactivation always wins);
  - existing member → checked on email, then alias. Valid → in, recorded in
    `members.membership_status/membership_verified_at` (migration 0014).
    Invalid → `/login?error=MembershipInactive`. API error → in (fail open) +
    `console.error`;
  - unknown email → valid card auto-provisions an active `utenti` member (audit
    `auto_provision_member`, actor `system`); invalid → `NotMember`; API error
    → `MembershipCheckUnavailable` (fail closed). Never provisioned when
    Google reports `email_verified: false`.
  - `saveOrder` rechecks non-admins when the last valid check is older than
    24h (a lapsed result is always rechecked); lapsed → refused with a renew
    link (`brand.membershipUrl`), API error → allowed. Saves that do not raise
    the cycle's total (trim/cancel) are never rechecked.
  - dev/demo credential providers never run the check.
- Denials redirect to `/login?error=<code>&email=<attempted>`; the login page
  explains each code and links `brand.supportEmail` and `brand.privacyUrl`.
- `requireUserSession()` — throws redirect to `/login` if not authenticated
- `requireAdmin()` — throws if `role !== 'admin'`
- `session.user.memberId` — the authenticated member's ID (set in Auth.js callbacks)

### Notifications

- Table `notifications`: `member_id | role | type | title | body | href | read_at | created_at`
- Notification types emitted by `admin.ts` / the cron route:
  - `order_closed` — cycle closure
  - `topup_received` — admin records a topup
  - `order_corrected` — admin edits a member's order via `adminEditClosedOrder`
  - `order_adjusted` — closed-cycle shipping recompute OR per-line "actual delivered" rectification
  - `cycle_opened` — a cycle is created (always created already-open, so this is the single emit point, in `adminCreateCycle`)
  - `cycle_closing_reminder` — **retired in v1.9.0.** No longer emitted. Rows sent while the feature existed remain in members' inboxes and fall through `categoryForType` to the unknown-type branch: rendered in-app, never emailed. Do not reintroduce the name for something else.
- **All emission goes through `lib/notifications/dispatch.ts`** (`dispatchNotification` for single members, `dispatchWithBodies` for per-member bodies like cycle close, `dispatchToMembers` for broadcasts). Never insert into `notifications` directly — dispatch is where channel preferences are honoured.
- **Preferences** (`notification_preferences`, sparse: absent row = code default). Categories + defaults live in `lib/notifications/categories.ts`: `cycle_opened` (app+email on), and `order_charge` / `order_updates` / `wallet_topup` (app on, email off). Members edit them at `/notifiche/impostazioni` (bell → ⚙) via `updateNotificationPreference`. Raw `type` values are unchanged in the DB; `categoryForType` maps them (unknown type → in-app only, never email). Stored rows for retired categories are ignored by `resolvePreferences`, so removing a category needs no data migration.
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
| `members` | User registry; `role`: admin / attivi / utenti |
| `order_cycles` | Weekly order windows; one `open` at a time |
| `products` | Per-cycle product list |
| `orders` | Order lines per member per cycle |
| `ledger_entries` | Balance: `topup` (+), `order_charge` (−), `shipping_charge` (−), `correction` (±), `adjustment` |
| `orders.actual_quantity` / `actual_line_total` | Recorded after delivery when the supplier weighed something different from what was ordered (e.g. 1 kg → 800 g). NULL = delivered as ordered. |
| `notifications` | Per-member or per-role messages with `read_at` |
| `payments` | Online top-ups (Stripe Checkout): `status` pending → succeeded / failed / expired → partially_refunded / refunded, amounts in integer cents |
| `audit_log` | Append-only admin action log |
| `suppliers` | Supplier registry |
| `supplier_products` | Supplier product catalog (source for cycle products) |

ID prefix convention: `cyc_*`, `mem_*`, `prd_*`, `ord_*`, `led_*`, `not_*`, `aud_*`, `sup_*`, `spr_*`, `pay_*`.

### Key Business Rules

- Closing a cycle auto-generates `order_charge` ledger entries + `order_closed` notifications for every member with orders.
- Member balance = `SUM(ledger_entries.amount)` for that member.
- Negative balance is allowed — UI warns — down to the optional credit limit
  `brand.minBalance` (null = no limit; Porta Moneta: -50). `saveOrder` refuses
  a save when balance − uncharged orders on other open cycles − the new total
  would fall below it (saves that do not raise the cycle's total always pass).
  The check runs before the write batch, so concurrent saves can overshoot it.
- Expected `saveOrder` refusals are returned as `{ success: false, error }`,
  not thrown: Next.js masks thrown Server Action messages in production.
- Products loaded from semicolon-delimited text: `Name;Variant;Format;Price;Supplier;Notes`.
- Email is the unique member identifier (login key). Alias email supported for non-Google accounts.

### Post-closure adjustments

The admin has four independent ways to correct a closed cycle:

1. **Edit cycle metadata** (`adminUpdateCycle` on a `status='closed'` cycle) — change title/notes/pickup dates/supplier freely; changing shipping mode or amount **recomputes `shipping_charge` ledger entries in place** for every member with orders and emits `order_adjusted` notifications. `orderCloseAt` and `accessLevel` are locked (supplier stays editable post-closure since a cycle can close before one was ever set — that's the only way to unblock the "Fornitore" send/import actions on it). UI: ✎ Modifica button in admin → Ultimi cicli.
2. **Edit a member's whole order** (`adminEditClosedOrder`) — change integer quantities, add or remove products, or create an order from scratch for a member who didn't originally participate. Posts a single `correction` ledger entry with the delta vs the original total. Original `order_charge` row is left intact. UI: ✎ Modifica button on each member row inside Recap ordini.
3. **Record actual delivered weight/cost per line** (`adminUpdateOrderLineActuals`) — for the case where 1 kg of beetroot weighed 800 g. Writes the actuals to `orders.actual_quantity` / `orders.actual_line_total` and posts a `correction` ledger entry with the delta. Composes with #2 because both use the same correction-ledger model. UI: click any order line inside Recap ordini.
4. **Import a supplier-filled distinta (`.xlsx`)** (`adminApplyDistintaImport`) — round-trip flow: `📧 Fornitore` sends an Excel sheet built by `lib/csv/distinta-builder.ts` (products × members matrix with formulas + locked refs + hidden `_meta` sheet carrying cycleId/productId/memberId). The supplier overwrites the yellow cells after weighing, sends the file back, the admin uploads it via `📤 Carica distinta`. The parser (`lib/csv/distinta-parser.ts`) shows a diff preview; on apply, every product correction goes through `adminUpdateOrderLineActuals` (#3 above), while the shipping row writes `shipping_charge` ledger entries directly per member and flips `orderCycles.shippingMode` to **`"manual"`**. The `manual` sentinel causes `recomputeShippingForClosedCycle` to early-return, so a later admin edit to the shipping field won't overwrite the per-member values (the cycle form shows an orange banner instead of the shipping inputs).

All four emit `order_adjusted` or `order_corrected` notifications and `audit_log` entries.

### Online top-ups (Stripe)

- Optional per deploy: `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`. Without
  a key `/ricarica` shows only the bank details (`brand.bankTransfer`, or a
  "ask the treasurer" line when null). `resolveStripeKey`
  (`lib/payments/config.ts`) accepts live keys only on a real production deploy
  and test keys everywhere else, demo included.
- Flow: `startOnlineTopup` (`lib/actions/topup.ts`) validates the amount
  (0,50-300 €; 0,50 is Stripe's EUR minimum charge), inserts a `pending` payment and opens a hosted Checkout Session
  (idempotency key = paymentId, 30 min expiry) whose success/cancel URLs point
  back at the deploy the member is on. `/ricarica` only displays the payment
  row's status; **only the signed webhook credits**.
- Webhook `app/api/stripe/webhook/route.ts`, excluded from the auth
  middleware, verifies the signature on the raw body and rejects events whose
  `livemode` differs from the key's. `lib/payments/webhook.ts` maps events
  (`planWebhookAction`, pure) and applies each as ONE SQL statement: a guarded
  `UPDATE payments ... WHERE status = 'pending'` feeding the ledger `INSERT`,
  so a replayed or concurrent event writes nothing. Refunds post the delta of
  the cumulative `charge.amount_refunded` as a negative `correction`
  (`FOR UPDATE` serialises concurrent refunds); a refund that arrives before
  its credit answers 500 so Stripe retries it. An amount/currency mismatch is
  not credited: it is logged and audited as `stripe_topup_mismatch`.
- Ledger rows with a `payment_id` cannot be edited or deleted from Cassa.
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
  both are throwaway (reset on demand). The `staging` branch deployment is the
  exception: its branch-scoped Preview `DATABASE_URL` points at the Neon
  branch `staging` instead. A per-PR Neon branch integration would be a
  further upgrade, not required.
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

### Design System — Orange/Teal

CSS variables in `app/globals.css` as Tailwind v4 `@theme`:

| Token | Value | Use |
|---|---|---|
| `--pm-orange` | #F5A623 | Primary brand, buttons, active nav |
| `--pm-orange-light` | #FEF3DC | Saldo positive background |
| `--pm-teal` | #00A896 | Cycle open badge, topup accent |
| `--pm-teal-light` | #E0F5F3 | Teal backgrounds |
| `--pm-red` | #E05252 | Negative balance, errors |
| `--pm-near-black` | #2d2b29 | Primary text |
| `--pm-gray` | #58595B | Secondary text |
| `--pm-warm-white` | #faf8f5 | App background |
| `--pm-border` | rgba(88,89,91,0.10) | Borders |

Key patterns:
- **Saldo hero card**: orange-light (positive) or red-light (negative), 70px balance amount
- **Pill steppers** in order form: zero-state (single + btn) vs has-qty state (−/qty/+)
- **Bottom nav**: 5 tabs, orange active state, SVG icons
- **Notification bell**: in header, red badge with count, links to `/notifiche`
- Max-width **480px centered** on desktop; `bg-pm-frame` (#ddd8d0) frames the app

### Known Gotchas

- `AppShell` is an **async Server Component** (fetches unread notification count). Don't convert to Client Component.
- Every page that renders `AppShell` must pass `memberId={session.user.memberId!}`.
- All Server Actions use `requireUserSession()` / `requireAdmin()` — never trust client payloads for auth.
- `revalidatePath()` must be called after mutations so Server Components re-fetch fresh data.
