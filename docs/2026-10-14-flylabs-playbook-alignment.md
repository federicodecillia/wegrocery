# Plan: aligning WeGrocery with the FlyLabs Playbook

Date: 2026-10-14. Playbook version: 0.4 (`flylabs-ai/flylabs-kit`, `PLAYBOOK.md`, commit `8fd13d2`).
Status (2026-10-14): approved by Federico and implemented on PR #280, except the items below. The tables that follow keep the review as it was written (the "today" column is the state before the PR).

- **Done**: dark theme with the FlyLabs tokens and the contrast test, fonts (Inter, Geist titles, JetBrains Mono labels), control height, cards without shadow, spacing on the Tailwind scale, restricted database role (`scripts/create-app-role.mjs`, `DATABASE_MIGRATION_URL`, configuration card item), safer migrations (one transaction, lock timeout, `Apply:`/`Rollback:` headers, `PRODUCTION_DB_HOST` + `--allow-prod`), weekly restore test workflow, email idempotency keys and one-click unsubscribe, welcome tour progress in the database (migration 0036), own usage counters (migration 0037), deviation list in `AGENTS.md`.
- **Left on purpose**: components on Base UI and lucide (Sheet and ConfirmDialog keep swipe and focus return, the nightly UI check guards them), "?" help links on admin pages, branded email template (waits for the kit registry), changelog heading style.
- **Federico's hands**: the restore test needs `RESTORE_TEST_NEON_API_KEY` (a key scoped to the dedicated Neon project; CI's `NEON_API_KEY` is scoped to the CI project) and one manual run once the workflow is on `main`; the Mac-side steps (`PRODUCTION_DB_HOST`, `app_rw` on every database, production last) run through a Remote Control session he authorized.

This plan checks every Playbook rule against the code on `staging` (commit `7c196b0`) and proposes what to change, how much it costs and when. The two intended deviations stay as they are: the group's own colours (2.10) and repository docs in English (3.3).

How to read the table:

- **Status**: `OK` the rule is followed; `Listed` a deviation already in the "FlyLabs Kit" block of `AGENTS.md`; `Unlisted` a deviation this review found (added to `AGENTS.md` in the same PR); `Partial` followed in part; `N/A` the rule does not apply today.
- **Cost**: S (hours, one small PR), M (one or two days, one PR), L (several PRs).
- **Risk**: what could break, with special attention to money (ledger, balances, payments), which must never regress.
- **When**: `Now` (before stage 1, small and safe) or `Stage 1` (stage 1 of the kit, December 2026). `Keep` means the deviation stays.

Stellar was read at `federicodecillia/stellar-reviews` commit `81bc7b6` for the theme, the contrast test, components and navigation.

## 1. Rule by rule

### 1. Stack

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 1.1 Next.js App Router, React 19, TS strict, Next 16 | OK: `package.json:30-32` (next ^16.3.8, react ^19.3.0), `tsconfig.json:10` (`strict: true`) | None | - | - | - |
| 1.2 Tailwind 4, tokens in `globals.css` with `@theme inline`, no `tailwind.config` | OK: `app/globals.css:18` (`@theme inline`), no `tailwind.config.*` in the repo | None | - | - | - |
| 1.3 Neon HTTP driver + Drizzle | OK: `lib/db/client.ts:1-2,15-16` (`neon()` + `drizzle-orm/neon-http`) | None | - | - | - |
| 1.4 App connects with a role without schema privileges | Unlisted: one `DATABASE_URL` (the owner) for app and migrations, `lib/db/client.ts:7`, `scripts/db-migrate.mjs:29` | Create an `app_rw` role per database (DML only), give the app `DATABASE_URL` = `app_rw`, keep the owner in a separate `DATABASE_MIGRATION_URL` for `db-migrate` and `MIGRATE_ON_BUILD`. Document in `docs/self-hosting.md` and `docs/upgrading.md`, add an item to `lib/config-status.ts`. The append-only trigger on `ledger_entries` and the `wegrocery.ledger_maintenance` switch must keep working with the new role (integration test). | M | Medium: a missing GRANT breaks a page or an action in production; every installation (prod, demo, example-brand, new groups) needs the role. Money: positive, the app could no longer drop the ledger trigger. | Stage 1 |
| 1.5 Better Auth exact version, email link + 6-digit code, endpoint allowlist, proxy reads only the cookie | OK: `package.json:24` (`better-auth: 1.7.5`), `lib/auth/public-endpoints.ts`, `proxy.ts` (cookie only) | None | - | - | - |
| 1.6 Resend, templates as TS functions | OK: `lib/email/resend.ts`, `lib/email/templates.ts` | Branded format: see 7.7 | - | - | - |
| 1.7 Vercel `fra1`, deploy from GitHub, previews on a separate DB | OK: `vercel.json:3` (`fra1`), previews on the Neon `dev` branch (`AGENTS.md`, "Database environments") | None | - | - | - |
| 1.8 Optional features off without their variable | OK: Stripe `lib/payments/config.ts:77`, Google `lib/auth/config.ts:56`, Sentry `lib/observability.ts:10` | None | - | - | - |

### 2. Style and interface

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 2.1 Geist titles, Inter body, JetBrains Mono for short uppercase labels | Unlisted: Geist for everything and Geist Mono (`app/layout.tsx:2,12-19`, `app/globals.css:52-53`); mono also for totals (197 `font-mono` uses in `app/` and `components/`) | Part of the style work, section 2 step 5 | M | Low: layout shifts from wider Inter glyphs, checked with screenshots | Stage 1 |
| 2.2 Role tokens with Playbook names (`danger`, `success`, `warning`, `-soft`/`-bg`); no hex in components | Partial: role tokens exist (`app/globals.css:18-46`, `lib/brand/roles.ts`) but danger is `brand-red`/`brand-red-light`, there is no `success`, and four hard-coded hex remain in admin components (`components/admin/ciclo-forms.tsx:1073`, `components/admin/payment-mode-card.tsx:53`, `components/admin/prodotti-forms.tsx:507,701`, the design guard skips admin: `lib/brand/design-guard.test.ts:61`) | Now: replace the four hex with tokens and extend the guard to admin. Stage 1: add `danger`, `danger-soft`, `success`, `success-soft`, keep `brand-red*` as aliases until every use is renamed | S now, S at stage 1 | Low | Now (hex), Stage 1 (names) |
| 2.3 Light, dark or device theme, cookie, `data-theme` | Listed: light only | Section 2 | L | Medium: see section 2 | Stage 1 |
| 2.4 Contrast test on every token pair in both themes | Listed: only the fixed colours are tested (`lib/brand/design-guard.test.ts:66-72`) and `brandContrastWarnings()` logs at runtime for brand colours | Section 2 step 2 | M | Low | Stage 1 |
| 2.4 (second half) Style test: no hand-written hex, no white text on primary, nothing under 12 px | OK: `lib/brand/design-guard.test.ts:50-62` (this rule comes from WeGrocery) | Extend to admin (see 2.2) | S | Low | Now |
| 2.5 Meaning never from colour alone | OK as far as checked: `Badge` always carries a text label (`components/ui/badge.tsx:4-30`), negative balance shows the minus sign | Re-check during the dark theme screenshots | - | - | Stage 1 |
| 2.6 44 px touch targets (`--control-h` 40, 44 on `pointer: coarse`); 16 px fields on phones | Partial: 16 px fields OK (`app/globals.css:116-124`); 44 px only through the `hit-44` utility (`app/globals.css:96`) and `min-h-12` buttons, while the small button is 36 px (`components/ui/button.tsx:35`); no `--control-h` token | Stage 1: add `--control-h` with the coarse media query (as in Stellar `web/app/globals.css:145,192-194`), small buttons use it | S | Low: denser admin tables get taller rows | Stage 1 |
| 2.7 shadcn on Base UI, lucide icons | Unlisted: own components in `components/ui/` on `@radix-ui/react-dialog` (`components/ui/sheet.tsx:4`, `components/ui/confirm-dialog.tsx:4`), hand-drawn icons (`components/nav-icon.tsx`, `components/ui-icon.tsx`, `components/movement-icon.tsx`) | Section 2 step 6. Domain icons (products, movements) may stay hand-drawn as the rule allows | L | Medium: the Sheet carries the swipe-to-close gesture and the focus return checked nightly by `scripts/ui-check.mjs` | Stage 1 |
| 2.8 Navigation logic in a tested module; bottom bar with "Altro" on phone, rail on tablet, sidebar on PC | Partial: logic tested (`components/nav-items.ts` + `.test.ts`, `lib/admin/nav.ts` + `.test.ts`, admin "⋯" menu); layout differs: bottom bar up to `lg`, top nav in the header from `lg`, no rail and no sidebar (`components/bottom-nav.tsx`, `components/top-nav.tsx`) inside one centred card (`components/shell-width.ts`) | Section 2 step 7, as a separate decision because it changes the shell | L | Medium: every page, the skeleton (`components/shell-skeleton.tsx`) and the nightly UI check | Done 2026-10-15: `components/side-nav.tsx` (rail from `md`, sidebar from `lg`), Federico's ok on the proposal with screenshots |
| 2.9 Cards with 1 px border and no shadow | Unlisted (small): `--shadow-card` (`app/globals.css:49`) used by `Card` (`components/ui/card.tsx:8`) | Drop the shadow in `Card`, keep the border | S | Low | Now |
| 2.10 White-label apps keep the group colours | Listed, intended: brand JSON and `group_identity` (`lib/brand/roles.ts:6`, `lib/brand/get-brand.ts`) | Keep | - | - | Keep |

### 3. Copy and languages

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 3.1 Strings in `lib/i18n/it.ts` (source), `en.ts` typed on it, keys checked | OK: `lib/i18n/it.ts:1,2156` (`Strings = typeof it`), `lib/i18n/en.ts:3` (`en: Strings`); the type check replaces a runtime key test | None | - | - | - |
| 3.2 Language per installation when single-language | OK: `lib/i18n/index.ts:5` (constant from `brand.locale`) | None | - | - | - |
| 3.3 Code in English; UI and client docs in Italian | Listed, intended: repository docs in English (public repo, portfolio) | Keep | - | - | Keep |
| 3.4 Never the em dash in copy; a test checks it | Unlisted: 21 em dashes in `lib/i18n/it.ts` (e.g. lines 830-831, 890, 1456, 2082, 2086, 2105, 2122) and 22 in `lib/i18n/en.ts`, including email subjects; the changelog headings use it by convention (`CHANGELOG.md` headings put an em dash between version and date, parsed by `lib/changelog.ts:65`, rule in `AGENTS.md`, "Updating the changelog"); only the guide has a test (`lib/guide/guide.test.ts:35`) | Now: replace the em dashes in UI and email strings (colon, comma or parentheses; the placeholder "seleziona" wrapped in em dashes becomes "Seleziona…"), add a test over `it.ts` and `en.ts` like the guide's. Stage 1: switch the changelog heading to `## [x.y.z] - date` (the parser already accepts `-`) and update the `AGENTS.md` rule; past entries can stay | S now, S later | Low: copy only; email subjects change wording | Now (strings), Stage 1 (changelog) |

### 4. Guide, first run, news

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 4.1 In-app guide of typed cards with steps, action links, `when` conditions | OK (rule from WeGrocery): `lib/guide/types.ts`, `lib/guide/it.ts`, `app/guida/` | Offer to the kit registry (section 3) | - | - | - |
| 4.2 Local search with synonyms; misses kept anonymous for 90 days | OK: `lib/guide/search.ts`, synonyms `lib/guide/it.ts:468`, `lib/guide/search-misses.ts:10` (`MISS_RETENTION_DAYS = 90`) | None | - | - | - |
| 4.3 "?" next to complex page titles | OK: `components/guide/help-link.tsx`, used in `app/ordine/order-form.tsx`, `app/ricarica/page.tsx`, `app/famiglia/page.tsx` | Add it to the admin pages that lack it when the style work touches them | S | Low | Stage 1 |
| 4.4 First run: steps ticked from real data, resumable, state in the DB | Partial: steps follow the settings, not the member's data (`lib/guide/welcome.ts:24-32`); dismissal in the DB (`members.welcome_dismissed_at`, `components/home/welcome-card.tsx:15`) but the current step lives in `sessionStorage` (`lib/guide/welcome.ts:52-54`) | Tick "order" and "top up" from real rows (first order, first top-up), keep the current step in the DB next to the dismissal. Needs a small additive migration | M | Low: no money writes, read only queries | Stage 1 |
| 4.5 Bilingual changelog, news in app, merge creates tag and release | OK (rule from WeGrocery): `CHANGELOG.md`, `CHANGELOG.it.md`, `lib/changelog.ts`, `.github/workflows/release.yml` | None (heading dash: see 3.4) | - | - | - |

### 5. Quality

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 5.1 CI on every PR: types, lint, unit, integration on a throwaway Postgres with real migrations, no DB secrets | Partial: types, lint, unit (`.github/workflows/ci.yml:38-45`); integration on a throwaway Neon branch (`ci.yml:83-107`) that needs the `NEON_API_KEY` secret and is skipped on forks | Keep Neon (the HTTP driver needs Neon's proxy; a plain Postgres service would need the local Neon proxy image). Record it as an intended deviation | - | - | Keep |
| 5.2 Unit tests next to the code, integration with their own suffix | OK: `*.test.ts` beside sources, `*.int.test.ts` (`vitest.int.config.ts`) | None | - | - | - |
| 5.3 Every migration has its test | Partial: only `test/int/migration-0021.int.test.ts`, `test/int/migration-0026.int.test.ts`, plus `test/int/fresh-install.int.test.ts` applying all 36 files from `0000` and `lib/migrations.ts` matched to `drizzle/` | From now on each new migration ships a test; no back-filling of the 34 old ones (the fresh-install run covers that they apply) | S per migration | Low | Now (new ones) |
| 5.4 axe end to end (WCAG 2.2 AA) and the 44 px rule, nightly on the demo, issue on failure | Partial: nightly after the demo reset with issue (`.github/workflows/ui-check.yml:12-14`), but tags stop at WCAG 2.1 (`scripts/ui-check.mjs:68`) and there is no 44 px check | Add `wcag22aa` to the tags and a check that interactive elements are at least 44 px on the phone viewport | S | Low: may open a first issue that then needs fixing | Now |
| 5.5 Never skip a test to get green | OK (`AGENTS.md`, CI rules) | None | - | - | - |

### 6. Data and migrations

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 6.1 Hand-written numbered SQL, additive; header with what, exact command and rollback | Partial: numbered, hand-written, additive and idempotent with a "what" header (e.g. `drizzle/0035_stripe_connection.sql:1-24`); no command and no rollback in the header | New migrations add "Apply:" and "Rollback:" lines to the header | S | Low | Now |
| 6.2 Each migration in a transaction with `lock_timeout`, with a `_down.sql` | Unlisted: `scripts/db-migrate.mjs:63-81` splits the file and runs statements one by one over HTTP, no transaction, no `lock_timeout`; no `_down.sql` files in `drizzle/` | Run each file in one transaction (`sql.transaction` of the Neon driver) with `SET LOCAL lock_timeout = '5s'`; `_down.sql` for new migrations only, skipped by the runner, tested on the CI branch | M | Medium: the runner applies every migration to prod, demo and every group; must be proven on the CI throwaway branch and the fresh install first. Money: a half-applied migration today could leave a ledger constraint missing, so this lowers risk | Stage 1 |
| 6.3 `_migrations` registry with `--status`; prod and staging commands run by Federico | Partial: registry OK (`scripts/db-migrate.mjs:35-50`, rule from WeGrocery); Federico asked on 2026-10-07 that Claude runs the release, migrations included, after a green manual backup and with his explicit ok for each production operation | Record as an intended deviation (Federico's choice) | - | - | Keep |
| 6.4 Scripts refuse production without explicit confirmation | Partial: `scripts/seed-demo.ts:3` refuses without `DEMO_MODE`, `scripts/migrate-on-build.mjs:11-12` skips previews; `scripts/db-migrate.mjs` has no guard (known follow-up in `AGENTS.md`, "Database environments") | Add `--allow-prod` to `db-migrate.mjs` comparing the host with a `PRODUCTION_DB_HOST` variable; `MIGRATE_ON_BUILD` passes it on production builds | S | Low | Now |
| 6.5 Verified daily backup; nightly consistency checks with an issue | Partial: dump, upload and prune (`.github/workflows/backup.yml:105-152`), invariants and issue (`backup.yml:178-208`, `lib/invariants.ts`); the dump is never restored to prove it | Add a weekly job: restore the latest dump into a throwaway Neon branch, count the main tables, delete the branch | M | Low: reads production only through the dump; needs a Neon API key with branch rights on the production project, which Federico must create | Stage 1 |

### 7. Operations

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 7.1 Public `/api/health` `{ok, version, db}`, 200/503, `no-store`, no error text | Listed (values differ from Stellar); shape, status, `no-store` and silence are OK: `app/api/health/route.ts:11-23` | Align with the FlyLabs Console | S | Low | With the Console |
| 7.2 One `reportError`; Sentry only with `SENTRY_DSN`, no personal data or SQL parameters | OK: `lib/observability.ts:10` (also reads `NEXT_PUBLIC_SENTRY_DSN`, set by the Vercel integration), `instrumentation.ts:5` | None | - | - | - |
| 7.3 Watchdog writes only on problems; the Action fails if the alert fails | OK: notify jobs in `backup.yml:189-208` and `ui-check.yml` open or comment one issue; a failing `gh issue` fails the job | None | - | - | - |
| 7.4 Crons call idempotent endpoints with a secret; curl only 200, never `-L` | OK: the app has no cron; the console cron checks its bearer and answers 404 (`console/app/api/cron/refresh/route.ts:19`); `deploy-hook.yml:33` uses `curl -fsS` without `-L` | None | - | - | - |
| 7.5 Configuration list in the panel and `npm run doctor`, names only | OK (rule from WeGrocery): `lib/config-status.ts:149`, `scripts/doctor.mts` | None | - | - | - |
| 7.6 Emails redirected outside production; in production idempotency key and one-click unsubscribe (RFC 8058) signed with HMAC | Partial: redirect OK (`lib/email/resend.ts:39`); no idempotency key; no `List-Unsubscribe` on purpose (`AGENTS.md`, "Email compliance": small private group, preferences link in the footer) | Stage 1: idempotency key on notification and supplier emails (Resend supports it); one-click unsubscribe per category with an HMAC-signed link that turns off the email channel in `notification_preferences`. Sign-in emails stay without it | M | Low: a wrong signature only fails the unsubscribe; sign-in emails are untouched | Stage 1 |
| 7.7 Branded emails (HTML + text, app logo, "By FlyLabs.ai") | Not done in any app yet: text only (`lib/email/templates.ts`) | Take the shared template from the kit registry when it exists; logo from `group_identity`, colours from the group tokens | M | Low: the text part stays; test on staging with `EMAIL_REDIRECT_TO` | Stage 1 |
| 7.8 Usage measured with own minimal events (`usage_events`), no third-party analytics | Unlisted: Vercel Analytics and Speed Insights in the root layout (`app/layout.tsx:6-7,71-72`, `package.json:22-23`); no `usage_events` | Now: remove both components (or keep Speed Insights only if Federico uses it). Stage 1: `usage_events` table with a few event names, no member id in clear, no demo | S now, M later | Low: removing analytics changes no behaviour | Now (remove), Stage 1 (events) |
| 7.9 Public demo with fake data, one-click login, nightly reset | OK: `.github/workflows/demo-reset.yml:13-14`, `scripts/seed-demo.ts`, demo buttons (`lib/auth/plugins.ts`) | None | - | - | - |
| 7.10 Internal panel 404 without the role, `noindex`, `no-store`, no client content; Console reads health and HMAC stats | Partial: the internal panel is the Console (`console/`): `noindex` OK (`console/app/layout.tsx:7`), only counts (`lib/instance-stats/`, HMAC), but it redirects to `/login` instead of a 404 (`console/proxy.ts:28`) and pages do not send `no-store`. The group's `/admin` is a product page for the group's own admins, not a FlyLabs panel; it redirects non-admins home (`app/admin/page.tsx:59`) | Console: add `Cache-Control: no-store` to its pages; keep its login page (it is password based, a 404 would hide the login) and record that as an intended deviation | S | Low | Now |

### 8. Legal and AI

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 8.1 Legal documents versioned, archived with SHA-256, checked before build | Unlisted: none in the app; each group links its own privacy notice (`brand.privacyUrl`, `docs/self-hosting.md:99`), because the group is the data controller | Keep for the groups (white-label). When FlyLabs hosts groups (model A) its own terms and DPA follow the rule; decide then | - | - | Keep (groups), later (FlyLabs hosting) |
| 8.2 AI-generated text marked for the AI Act | N/A: the app generates no text with AI (the guide assistant was postponed) | Apply when an AI feature arrives | - | - | - |
| 8.3 Claude never reads `.env*` except `.env.example` | Partial: followed in practice, not written in `AGENTS.md` | Add one line to `AGENTS.md` | S | - | Now |

### 9. How we work

| Rule | Status today (evidence) | Proposed change | Cost | Risk | When |
|---|---|---|---|---|---|
| 9.1 Dated spec and plan in `docs/` before big features | Unlisted: specs live in the private project folder, in Italian and with group details, not in the public repo (`docs/` holds only operating guides) | From now on a dated English plan in `docs/` (this file is the first), with no group or member data; the Italian working spec can stay private | S per feature | Low | Now |
| 9.2 `AGENTS.md` only, no `CLAUDE.md` | OK: symlink removed in `35d99a8`; `AGENTS.md:3` | None | - | - | - |
| 9.3 Branch per feature, PR with before and after, merge with Federico's ok | OK: `.github/pull_request_template.md`, PRs to `staging` | None | - | - | - |
| 9.4 Preview first, migration before merge, written rollback | OK: `docs/operating-two-environments.md`, `.github/PULL_REQUEST_TEMPLATE/release.md` | None | - | - | - |
| 9.5 Commands for Federico complete, one per block, with expected result | Partial by choice: Federico prefers that Claude runs the release steps rather than pasting commands (2026-10-07); when a command must go to him, this rule applies | Same intended deviation as 6.3 | - | - | Keep |

## 2. Dark theme with the FlyLabs style, and the contrast test

These are the largest items. The order below keeps every step shippable on its own, with no visible change until the theme switch appears, and touches no money code.

### What to take from Stellar

| Piece | Stellar file | How it lands in WeGrocery |
|---|---|---|
| Theme choice in a cookie, `system` = no cookie | `web/lib/theme.ts`, `web/app/theme-actions.ts` | Same module, cookie `wegrocery_theme`; the switch goes in Profile (`/profilo`), not in admin, because it is personal |
| Layout writes `data-theme` and `themeColor` | `web/app/layout.tsx:47-81` | `app/layout.tsx` already sets the brand variables on `<html>`; add `data-theme` and a `themeColor` per theme |
| Dark variant in CSS without JS | `web/app/globals.css:8-13` (`@custom-variant dark` on `data-theme` and `prefers-color-scheme`) | Copy as is |
| Contrast test over every pair, 4.5:1 text, 3:1 edges, focus and icons | `web/lib/theme-contrast.test.ts` | Same pairs and thresholds, but WeGrocery's colours come from the brand JSON at runtime (`lib/brand/roles.ts`), not from fixed hex in CSS: the test must run `roles.ts` over a set of palettes (the default, the example brand, a very light and a very dark primary) in both themes, instead of reading `globals.css` |
| `--control-h` 40 px, 44 px on coarse pointers | `web/app/globals.css:145,192-194` | Copy |
| Components: shadcn on Base UI, lucide | `web/components/ui/` (button, card, field, input, select, badge, notice, table, toast...), `package.json` (`@base-ui/react`, `lucide-react`) | Replace one component at a time (step 6) |
| Navigation module with sidebar | `web/components/nav.ts` + `nav.test.ts`, `Sidebar.tsx`, `MoreSheet.tsx` | Step 7 |

What not to take: Stellar's palette (2.10), and its locale switch (WeGrocery is single-language per installation, 3.2).

### Steps, in order

1. **Surface tokens (no visible change).** Replace hard-coded surfaces with tokens: 144 `bg-white`, the 22 `text-white`, `bg-black/[0.04]` in `Badge`, the four admin hex. New tokens: `surface`, `surface-2`, `foreground`, `border-strong`, plus `danger`, `success` with `-soft` (2.2). Old names stay as aliases. Extend the design guard to admin and forbid `bg-white`. Cost M, risk low.
2. **Contrast test (light theme only at first).** Port Stellar's test as described above, on today's light tokens, so the gate exists before any dark colour is written. Fold `brandContrastWarnings()` into the same functions. Cost M, risk low.
3. **Dark tokens.** In `lib/brand/roles.ts` derive the dark values from the same group colours (dark surfaces, a lighter `primary-text`, darker `-soft` tints, `on-primary` recomputed), so any group palette gets a dark theme with no extra setting. Extend the contrast test to the dark theme. Still hidden: nothing sets `data-theme="dark"` yet, and the device setting is ignored. Cost M, risk low.
4. **Theme switch.** Cookie, layout, `@custom-variant dark`, the choice in `/profilo`, screenshots on iOS, Android, tablet and PC in both themes, nightly UI check run in both themes. This is the first visible step. Cost M, risk medium (colours on every page; the PWA status bar; emails stay light).
5. **Fonts.** Inter for body text, Geist for titles, JetBrains Mono only for uppercase labels of up to four words; totals and amounts move to Inter with `tabular-nums`. Cost M, risk low (wider glyphs in tight admin tables).
6. **Components.** One PR per family, each with screenshots: Button and `--control-h`; Card (border, no shadow); fields (input, select, textarea, checkbox); Sheet and ConfirmDialog on Base UI Dialog, keeping `lib/ui/use-swipe.ts`, focus return and Esc (all checked nightly); Badge and notices; lucide for generic icons. Spacing: replace the 146 arbitrary pixel paddings and margins (`p-[18px]` and similar) with the scale of FlyLabs style v4 while each component is touched. Cost L, risk medium.
7. **Navigation (separate decision).** Rail on tablet and sidebar on PC mean leaving the single centred card (`components/shell-width.ts`) on large screens. Proposed with screenshots and approved by Federico on 2026-10-15; built in `components/side-nav.tsx`, phone layout unchanged.

Steps 1 to 3 can start before December without any visible change; steps 4 to 7 are stage 1.

## 3. What WeGrocery can give to the kit registry

| Module | Source in WeGrocery | What it needs before it fits every app | Cost |
|---|---|---|---|
| `guida` (in-app guide) | `lib/guide/` (typed cards, `when` conditions, local search with synonyms and stopwords, misses kept 90 days), `components/guide/help-link.tsx`, `app/guida/`, welcome card `lib/guide/welcome.ts` | Split the generic engine (types, search, misses) from WeGrocery's content and conditions; a README with the tables to create | M |
| Fleet console | `console/` (separate Next.js app, registry DB, nightly refresh), `lib/instance-stats/` and `app/api/instance-stats/` (HMAC-signed anonymous counts) | Make the stats shape app-neutral (counts by name), so Stellar can answer the same signed request; this is also the base of the FlyLabs Console (7.1, 7.10) | L |
| Bilingual changelog | `lib/changelog.ts` + test (parser with tagline and sections), the `/changelog` page, `.github/workflows/release.yml` (tag and release on merge) | Parametrise the file names and the release notes extraction; switch the heading dash (3.4) first | S |
| `_migrations` runner | `scripts/db-migrate.mjs` (`--status`, `--baseline`), `lib/migrations.ts` with its test against `drizzle/`, `scripts/migrate-on-build.mjs` + test | Add the transaction and `lock_timeout` (6.2) and the production guard (6.4) first, then publish | S |

Other candidates, smaller: the design guard (`lib/brand/design-guard.test.ts`), the configuration status (`lib/config-status.ts`, `npm run doctor`), the email redirect outside production (`lib/email/resend.ts`), and the money invariants pattern (nightly read-only checks with an issue, `lib/invariants.ts`, `scripts/check-invariants.mts`).

## 4. Summary

- **Now (small, safe):** four admin hex and guard on admin (2.2), em dash in UI and email strings with a test (3.4), card shadow (2.9), axe WCAG 2.2 and 44 px in the nightly check (5.4), migration headers and tests for new migrations (5.3, 6.1), production guard in `db-migrate` (6.4), remove Vercel Analytics (7.8), `no-store` on the Console (7.10), `.env` line in `AGENTS.md` (8.3), dated plans in `docs/` (9.1). About two days in all, no money code touched.
- **Before December, invisible:** dark theme steps 1 to 3 (tokens, contrast test, dark tokens).
- **Stage 1 (December 2026):** theme switch, fonts, components, `--control-h` (2.6), Playbook token names (2.2), first-run steps from data (4.4), migration transactions (6.2), app role without privileges (1.4), restore test of the backup (6.5), idempotency and one-click unsubscribe (7.6), branded emails (7.7), `usage_events` (7.8), changelog heading dash (3.4), navigation proposal (2.8).
- **Keep:** 2.10 group colours, 3.3 English docs, 5.1 Neon branches in CI, 6.3 and 9.5 releases run by Claude with Federico's ok, 7.10 Console login page, 8.1 privacy notice owned by each group.
