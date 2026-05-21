# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Porta Moneta GAS** is a web app for managing a community food cooperative (GAS — Gruppo di Acquisto Solidale frutta e verdura). Members log in with Google, place weekly produce orders, and track their balance. Admins manage cycles, products, suppliers, and member topups.

**Stack**: Next.js 15 App Router · Postgres (Neon serverless) · Auth.js (Google OAuth) · Drizzle ORM · Tailwind CSS v4 · Vercel

**Live**: gas.portamoneta.org

## Active Codebase: `app_gas/`

This is the only codebase. Everything is in `app_gas/`.

```
app_gas/
├── app/                        # Next.js App Router pages
│   ├── page.tsx                # Home: saldo hero, ciclo aperto, ultimi movimenti
│   ├── ordine/page.tsx         # Order form with per-product steppers
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

All commands from `app_gas/` directory:

```bash
cd app_gas
npm run dev          # Start dev server at http://localhost:3000
npm run build        # Production build
npm run db:push      # Push Drizzle schema to Neon (needs DATABASE_URL in .env.local)
npm run db:studio    # Drizzle Studio (visual DB browser)
```

**Deploy**: push to `main` → Vercel auto-deploys. Feature branches create preview deployments.

**Vercel Root Directory**: `app_gas` (set in project settings)

## Documentation conventions

The repository is public and used as a portfolio piece. Keep contributor-
and visitor-facing docs in English; only UI strings that the cooperative's
members actually read should be in Italian.

- **Code, identifiers, comments, JSDoc, commit messages, PR descriptions**:
  English only.
- **UI strings** (toasts, button labels, page copy, notification bodies):
  Italian — these reach real Italian-speaking users.
- **Two changelogs**: [`app_gas/CHANGELOG.md`](./app_gas/CHANGELOG.md) (English) and
  [`app_gas/CHANGELOG.it.md`](./app_gas/CHANGELOG.it.md) (Italian) follow the
  [Keep a Changelog](https://keepachangelog.com/) format and loose SemVer.
  They live inside `app_gas/` (not the repo root) so they are part of the
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

When cutting a release, move the `[Unreleased]` block to a new
`## [x.y.z] — YYYY-MM-DD` heading in both files and add the matching link
reference at the bottom.

## Architecture

### Request Flow

```
Browser → Next.js Server Component (data fetch via queries.ts)
        → JSX response with Server Action handlers
User interaction → Server Action ("use server") → auth check → DB mutation → revalidatePath()
```

### Auth

- Google OAuth via Auth.js. Only emails in the `members` table can log in.
- `requireUserSession()` — throws redirect to `/login` if not authenticated
- `requireAdmin()` — throws if `role !== 'admin'`
- `session.user.memberId` — the authenticated member's ID (set in Auth.js callbacks)

### Notifications

- Table `notifications`: `member_id | role | type | title | body | href | read_at | created_at`
- Notification types emitted by `admin.ts`:
  - `order_closed` — cycle closure
  - `topup_received` — admin records a topup
  - `order_corrected` — admin edits a member's order via `adminEditClosedOrder`
  - `order_adjusted` — closed-cycle shipping recompute OR per-line "actual delivered" rectification
- `AppShell` fetches `getUnreadNotificationCount(memberId)` and passes it to `NotificationBell`
- Bell in header → `/notifiche` page → `markNotificationRead` / `markAllNotificationsRead` Server Actions

### Role System

- `admin` — full access including admin panel
- `attivo` (alias `member`) — can order
- `socio` — read-only

Cycle `access_level` controls who can order: `'attivi'` (default) or broader.

### Data Model (Neon Postgres, Drizzle ORM)

| Table | Purpose |
|---|---|
| `members` | User registry; `role`: admin / attivo / socio |
| `order_cycles` | Weekly order windows; one `open` at a time |
| `products` | Per-cycle product list |
| `orders` | Order lines per member per cycle |
| `ledger_entries` | Balance: `topup` (+), `order_charge` (−), `shipping_charge` (−), `correction` (±), `adjustment` |
| `orders.actual_quantity` / `actual_line_total` | Recorded after delivery when the supplier weighed something different from what was ordered (e.g. 1 kg → 800 g). NULL = delivered as ordered. |
| `notifications` | Per-member or per-role messages with `read_at` |
| `audit_log` | Append-only admin action log |
| `suppliers` | Supplier registry |
| `supplier_products` | Supplier product catalog (source for cycle products) |

ID prefix convention: `cyc_*`, `mem_*`, `prd_*`, `ord_*`, `led_*`, `not_*`, `aud_*`, `sup_*`, `spr_*`.

### Key Business Rules

- Closing a cycle auto-generates `order_charge` ledger entries + `order_closed` notifications for every member with orders.
- Member balance = `SUM(ledger_entries.amount)` for that member.
- Negative balance is allowed — UI warns but does not block ordering.
- Products loaded from semicolon-delimited text: `Name;Variant;Format;Price;Supplier;Notes`.
- Email is the unique member identifier (login key). Alias email supported for non-Google accounts.

### Post-closure adjustments

The admin has four independent ways to correct a closed cycle:

1. **Edit cycle metadata** (`adminUpdateCycle` on a `status='closed'` cycle) — change title/notes/pickup dates freely; changing shipping mode or amount **recomputes `shipping_charge` ledger entries in place** for every member with orders and emits `order_adjusted` notifications. `orderCloseAt`, `supplierId`, `accessLevel` are locked. UI: ✎ Modifica button in admin → Ultimi cicli.
2. **Edit a member's whole order** (`adminEditClosedOrder`) — change integer quantities, add or remove products, or create an order from scratch for a member who didn't originally participate. Posts a single `correction` ledger entry with the delta vs the original total. Original `order_charge` row is left intact. UI: ✎ Modifica button on each member row inside Recap ordini.
3. **Record actual delivered weight/cost per line** (`adminUpdateOrderLineActuals`) — for the case where 1 kg of beetroot weighed 800 g. Writes the actuals to `orders.actual_quantity` / `orders.actual_line_total` and posts a `correction` ledger entry with the delta. Composes with #2 because both use the same correction-ledger model. UI: click any order line inside Recap ordini.
4. **Import a supplier-filled distinta (`.xlsx`)** (`adminApplyDistintaImport`) — round-trip flow: `📧 Fornitore` sends an Excel sheet built by `lib/csv/distinta-builder.ts` (products × members matrix with formulas + locked refs + hidden `_meta` sheet carrying cycleId/productId/memberId). The supplier overwrites the yellow cells after weighing, sends the file back, the admin uploads it via `📤 Carica distinta`. The parser (`lib/csv/distinta-parser.ts`) shows a diff preview; on apply, every product correction goes through `adminUpdateOrderLineActuals` (#3 above), while the shipping row writes `shipping_charge` ledger entries directly per member and flips `orderCycles.shippingMode` to **`"manual"`**. The `manual` sentinel causes `recomputeShippingForClosedCycle` to early-return, so a later admin edit to the shipping field won't overwrite the per-member values (the cycle form shows an orange banner instead of the shipping inputs).

All four emit `order_adjusted` or `order_corrected` notifications and `audit_log` entries.

### Email (Resend)

- Sending the closed-cycle order to the supplier (`adminSendSupplierEmail`) uses Resend. The acting admin **and `gas@portamoneta.org`** (shared GAS archive) are always in CC.
- Env vars: `RESEND_API_KEY`, `MAIL_FROM`. Without them the button toasts the missing-config error and the rest of the app keeps working.
- Modules: `lib/email/resend.ts` (thin SDK wrapper, lazy env read), `lib/email/templates.ts` (Italian body), `lib/csv/distinta-builder.ts` (round-trip `.xlsx` distinta — products × members matrix with formulas, hidden `_meta` for re-import), `lib/csv/distinta-parser.ts` (reads the supplier-filled file, returns a diff preview). `lib/csv/supplier-export.ts` is kept as a legacy per-product CSV but no longer the default attachment.
- Resend SDK detail: the `content` field on attachments base64-decodes strings — always pass a `Buffer`.

### Backup & Restore

Neon free tier only retains 7 hours of point-in-time history, so we ship a weekly off-site backup to Google Drive.

**Workflow**: [`.github/workflows/backup.yml`](.github/workflows/backup.yml) runs every Sunday at 03:00 UTC (also via `workflow_dispatch`). It `pg_dump`s the Neon production DB, gzips the result, and `rclone copy`s it to `gdrive:PortaMoneta/GAS-Backups/`.

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
