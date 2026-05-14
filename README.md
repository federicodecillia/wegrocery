# Porta Moneta GAS

A production web app that runs the weekly purchasing cycle of a real Italian
food cooperative (GAS — *Gruppo di Acquisto Solidale*). Members log in with
Google, place orders inside a time-boxed cycle, and track a running ledger
balance. Admins manage cycles, products, suppliers, top-ups, and analytics.

**Live:** [gas.portamoneta.org](https://gas.portamoneta.org)
**Changelog:** [English](./CHANGELOG.md) · [Italiano](./CHANGELOG.it.md)

The UI is in Italian because that's the target audience. Code, identifiers,
and documentation are in English.

---

## Stack

- **Next.js 15** App Router + React 19 + TypeScript strict mode
- **Postgres** on [Neon](https://neon.tech) (HTTP driver, serverless)
- **Drizzle ORM** with hand-written migrations
- **Auth.js v5** (Google OAuth) with an email whitelist enforced against the `members` table
- **Tailwind CSS v4** with a custom theme (orange/teal/warm white)
- **Vercel** for hosting and CI/CD (auto-deploy on push to `main`)

No charting library, no UI kit, no state-management library. The whole admin
analytics dashboard is rendered with pure CSS and inline SVG.

---

## Project structure

```
app_gas/
├── app/                       # Next.js App Router
│   ├── page.tsx               # Home: balance hero, open cycles, recent ledger
│   ├── ordine/                # Order form (per-product +/- steppers)
│   ├── storico/               # Order history + ledger movements
│   ├── notifiche/             # In-app notifications
│   ├── guida/                 # FAQ
│   └── admin/                 # Admin panel with 7 tabs
├── components/
│   ├── app-shell.tsx          # Layout wrapper (header + bottom nav)
│   ├── home/                  # Home-only components
│   ├── admin/                 # One component per admin tab + shared modals
│   └── ui/                    # Button, Card, Toast, ConfirmDialog, FaqAccordion
├── lib/
│   ├── db/
│   │   ├── schema.ts          # Drizzle schema
│   │   ├── queries.ts         # Read-only query helpers
│   │   └── client.ts          # Neon connection
│   ├── actions/               # Server Actions (admin, order, notifications)
│   └── auth/session.ts        # requireUserSession(), requireAdmin()
├── drizzle/                   # Hand-written SQL migrations
├── auth.ts                    # Auth.js v5 config
├── middleware.ts              # Auth gate (redirect to /login)
└── SETUP.md                   # Step-by-step local setup guide
```

---

## Highlight features

### For members
- **Balance hero card** — the running ledger total, big and unmissable. Turns
  red when below zero with a one-click "top up" CTA.
- **Live order draft** — quantities update in real time alongside a "balance
  after order" projection so members never accidentally overspend.
- **"Repeat last order"** — one click prefills the cart with the previous
  cycle's order, matched by product identity (so it still works after the
  admin recreates products per cycle).
- **"Next pickup" card** — promotes the most-asked information ("when do I
  pick up?") to a prominent home card with a days-until counter.
- **In-app notifications** — bell icon with unread badge. Cycle-close
  notifications deep-link straight to the relevant cycle in the history.

### For admins
- **Atomic cycle close** — uses a compare-and-swap `UPDATE ... RETURNING`
  so two admins clicking "close" at the same time can never produce
  duplicate ledger entries. If charge insertion fails mid-flow, the
  status flip is rolled back so the cycle can be retried cleanly.
- **Shipping split modes** — choose between flat per-member fee or
  proportional to each member's order value. The proportional mode rounds
  each share to two decimals and absorbs sum-of-cents drift on the
  largest order so the total stays exact and reruns are deterministic.
- **Close with price adjustments** — for weight-based items (e.g. "1 kg of
  salad" weighed at 1.2 kg) the admin opens a modal, edits the per-product
  unit price, and the system recomputes every order line and ledger entry
  before posting charges.
- **Analytics dashboard** — top 10 products, revenue trend across the last
  12 closed cycles, supplier ranking, member engagement bands. Everything
  scoped to closed cycles only so the numbers are stable.
- **Insight mini-cards** — three at-a-glance metrics above the cycle list:
  cycles closing in the next 24h, members below zero balance, top product
  in the last 30 days.
- **Supplier CSV export** — one click downloads a UTF-8 CSV (with BOM, so
  Excel recognizes it) aggregated by product, ready to email to the
  supplier.
- **Catalog reuse** — supplier products live in a separate `supplier_products`
  table. When the price of a catalog item changes, the previous version is
  archived (not overwritten) so historical orders still resolve correctly.

---

## Architecture notes

### Server-first
Every page is a React Server Component that fetches its own data via
Drizzle queries. Mutations go through Next.js Server Actions with
`requireUserSession()` / `requireAdmin()` guards — the client never gets
direct DB access and never receives sensitive credentials.

### Data model
| Table | Purpose |
|---|---|
| `members` | Roster + role (`admin` / `attivo` / `socio`) + email whitelist |
| `order_cycles` | Time-boxed purchasing windows with shipping config |
| `products` | Per-cycle catalog snapshot (so historical prices stay frozen) |
| `supplier_products` | Reusable supplier catalog with price-change history |
| `orders` | Line items: `(memberId, cycleId, productId) → quantity` |
| `ledger_entries` | Append-only balance log: top-ups, order charges, shipping |
| `notifications` | Per-member or per-role messages with read-at timestamp |
| `audit_log` | Append-only trace of admin actions |
| `suppliers` | Supplier registry |

### Concurrency
The HTTP driver (`@neondatabase/serverless`) doesn't support interactive
transactions, so all multi-statement workflows use a CAS pattern:
`UPDATE ... WHERE status='X' RETURNING ...` followed by per-row inserts,
with a manual rollback (status flip back) if a follow-up step fails.

### No charting library
The admin analytics tab draws four chart types — horizontal bar, area+line
trend, bar ranking, and a categorical split — using only Tailwind utilities
and inline SVG with a `viewBox`. Total bundle cost: zero.

### Italian localization
UI strings are in Italian because the users speak Italian. The codebase
itself (identifiers, comments, commit messages, PR descriptions, docs) is
in English, so the repo is readable by anyone.

---

## Local development

See [app_gas/SETUP.md](app_gas/SETUP.md) for the full step-by-step setup
(env vars from Vercel, `AUTH_SECRET` and `DATABASE_URL` for the Sensitive
vars that `vercel env pull` doesn't export, schema sync via Drizzle Kit,
etc.).

Quick start once `.env.local` is in place:

```bash
cd app_gas
npm install
npm run db:push     # apply schema.ts to Neon
npm run dev         # http://localhost:3000
```

Other scripts:

| Script | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload (Next.js) |
| `npm run build` | Production build + type check |
| `npm run db:push` | Apply Drizzle schema changes to the linked Postgres |
| `npm run db:studio` | Drizzle Studio (visual DB browser) |

---

## Deployment

Pushing to `main` triggers a Vercel production deploy. Feature branches
get automatic preview deployments. Vercel's project root is set to
`app_gas/`. Schema migrations to Neon are run manually with
`npm run db:push` from the local laptop before merging breaking changes,
so the database is always one step ahead of the live code.

---

## License

This repository is published primarily as a portfolio piece. The code
covers a real production app serving a real food cooperative, but the
brand assets (`logo.png`, the `portamoneta.org` domain) belong to APS
Porta Moneta and are not licensed for reuse.

If you want to adapt the patterns here (cycle/ledger model, atomic
close-cycle, proportional shipping split, etc.) to your own GAS or
co-op project, open an issue and let's talk.
