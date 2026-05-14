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
│   │   ├── admin.ts            # Admin Server Actions: cycles, ledger, topup, members, suppliers
│   │   ├── admin-cycles.ts     # Cycle-specific actions
│   │   ├── admin-products.ts   # Product/catalog actions
│   │   ├── notifications.ts    # markNotificationRead, markAllNotificationsRead
│   │   └── order.ts            # saveOrder (member)
│   └── auth/session.ts         # requireUserSession(), requireAdmin(), getUserRole()
├── middleware.ts                # Redirect unauthenticated to /login
├── auth.ts                     # Auth.js config (Google provider, member whitelist callback)
├── drizzle/                    # SQL migrations (0000–0003)
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
- **Two changelogs**: [`CHANGELOG.md`](./CHANGELOG.md) (English) and
  [`CHANGELOG.it.md`](./CHANGELOG.it.md) (Italian) follow the
  [Keep a Changelog](https://keepachangelog.com/) format and loose SemVer.

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
- Emitted by `admin.ts`: on cycle close (`order_closed`) and topup (`topup_received`)
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
| `ledger_entries` | Balance: `topup` (+), `order_charge` (−), `adjustment` |
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
