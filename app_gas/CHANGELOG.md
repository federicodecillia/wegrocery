# Changelog

All notable changes to the Porta Moneta GAS app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **Major** — breaking changes that require user re-onboarding
- **Minor** — new features, no breaking changes
- **Patch** — bug fixes, UI polish, documentation

> 🇮🇹 La versione italiana di questo file è [CHANGELOG.it.md](./CHANGELOG.it.md).
> Le due versioni devono restare sincronizzate.

---

## [Unreleased]

_Nothing yet._

---

## [1.4.3] — 2026-05-17

### Added
- **Reference price-per-kg** on every product (optional). Admins can fill it for weight-based items (e.g. €5,00 the cestino, €15,00/kg) and members see both prices in the order form. Surfaced everywhere a price appears: catalog, order form, supplier detail.
- **Inline help tooltips** on every field of the product form. Hover (or tap) the small "?" next to a label to get a one-line example explaining what to put in.

### Changed
- **Product form simplified**: removed the "Unità" field (it duplicated the format string and confused admins). The form now asks for Nome · Varietà · Formato · Categoria · Prezzo · Prezzo/kg (opzionale) · Note · Icona.
- **Category is now a dropdown**: predefined list (Frutta, Verdura, Pane e cereali, Pasta e riso, Latticini, Uova, Carne, Pesce, Conserve, Olio e aceto, Bevande, Dolci, Altro) merged with whatever the supplier already uses, plus an inline "+ aggiungi nuova categoria" row for one-off additions.
- **CSV template updated** to the new column layout `Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note`. The importer still accepts the old "Unità" layout for backward compatibility.

---

## [1.4.2] — 2026-05-17

### Added
- **Searchable emoji picker** for the product icon field. Click the icon to open a popover with ~80 food-relevant emojis, type to filter by Italian keywords (e.g. "pomodoro", "miele", "carciofo"). The previous free-text input is gone — admins no longer have to remember the system shortcut for the emoji keyboard.

### Changed
- **Member balances reset to match the legacy CASSA spreadsheet** in preparation for going live. Every existing ledger entry (test data) was removed and replaced with one seed `adjustment` entry per member carrying the closing balance from the "FRUTTA E VERDURA 2025-2026 → CASSA" sheet. Members not listed in the sheet start at zero.

---

## [1.4.1] — 2026-05-14

### Added
- **"Cosa è cambiato" page** inside the app at `/changelog`. Linked from the bottom of the Guide page. Has an IT/EN toggle so the page itself is bilingual.
- **"Novità" section in the Guide** showing a teaser of the most recent release (latest two sections, up to four bullets each) plus a link to the full changelog.

### Changed
- Supplier CSV export is now itemized per member (one row per supplier × product × member). Sorted by supplier → product → member name so the file can be used directly to prepare each member's bag.
- Subtotal rows removed from the supplier CSV — every row is now a real order line, so suppliers can't accidentally double-count by summing both per-member rows and a subtotal.

---

## [1.4.0] — 2026-05-14

### Added
- **Admin analytics dashboard** — a new "Stats" tab in the admin panel with:
  - Top 10 most ordered products (horizontal bar chart)
  - Revenue trend across the last 12 closed cycles (line + area chart, with % delta vs previous cycle)
  - Supplier ranking by revenue, with top-selling product per supplier
  - Member participation breakdown (active / occasional / dormant bands)
  - Four overview cards: closed cycles, active members, total revenue, top product
- **Admin home insight cards** — three at-a-glance metrics above the cycle list:
  - "In scadenza" (cycles closing within 24h)
  - "Saldo < 0" (members with negative balance)
  - "Top 30gg" (best-selling product in the last 30 days)
  - Each card is clickable and deep-links to the relevant admin tab
- **Supplier CSV export** — one-click download from the closed-cycle details modal. UTF-8 with BOM (Excel-compatible), semicolon delimiter, comma decimal (Italian Excel convention)
- **English README** — public-ready project description with architecture notes, suitable for portfolio showcase

---

## [1.3.0] — 2026-05-10

### Added
- **"Riproponi ultimo ordine"** button in the order form — one click prefills the cart with the member's most recent past order, matched by product identity. Visible only when the cart is empty so it can never overwrite work in progress
- **"Prossimo ritiro"** card on the home page, between the balance and the cycles list. Shows the day, time window, supplier, and a days-until counter (visible when ≤ 14 days away)

### Performance
- Added missing DB indexes on `products.cycle_id` and `ledger_entries.cycle_id` — both columns are queried on every admin and order page load

---

## [1.2.0] — 2026-05-10

### Added
- **Proportional shipping split** — when closing a cycle, the admin can choose between flat per-member shipping or proportional to each member's order value. In proportional mode the total shipping is split with two-decimal rounding, cent-drift absorbed deterministically into the largest order so the sum stays exact
- **Close cycle with price adjustments** — new admin workflow for weight-based items (e.g. 1 kg of salad weighed at 1.2 kg). Opens a modal where the admin edits each product's final unit price; the system recomputes every order line and ledger entry before posting charges
- **SETUP.md** — step-by-step local development guide covering the `vercel env pull` gotchas (Sensitive vars not exported, `DATABASE_URL` vs `NEON_URL`, etc.)

### Fixed
- `drizzle-kit push` now reads `.env.local` correctly via Node's `--env-file` flag — previously it only loaded `.env` and silently failed with `url: ''`

---

## [1.1.0] — 2026-05-10

### Fixed
- **Race condition on cycle close (critical)** — `adminCloseCycle` now uses an atomic compare-and-swap (`UPDATE ... WHERE status='open' RETURNING`) instead of a separate check + update. Two admins clicking "Close" simultaneously can no longer produce duplicate ledger charges. On error during ledger insertion the status flip is rolled back so the cycle can be retried cleanly
- **Silent fail on cycle closure during ordering** — if an admin closes a cycle while a member is editing the order form, the form now refreshes immediately with a toast instead of failing without feedback
- **Negative balance now red on the Movimenti tab** of the order history, consistent with the home page
- **Cycle close notification** now mentions the shipping charge in its body and deep-links to the specific cycle in the history (`/storico?cycleId=...`)
- **Logo in the header** is now clickable (links to home)
- **Bottom nav** respects the iPhone home-indicator safe area
- **Empty category section** in the order form: products without a category are now grouped under "Altro" when other named categories exist, instead of rendering an unlabeled section

---

## [1.0.0] — 2026-05-05

### Added
- Initial production release of the Next.js 15 rewrite (Apps Script → Next.js migration)
- Member-facing features: balance hero, order form with per-product steppers, order/movement history, in-app notifications, FAQ guide
- Admin panel with 6 tabs: cycle management, products, orders, cash/ledger, members, suppliers
- Google OAuth login via Auth.js with email whitelist on the `members` table
- Neon Postgres + Drizzle ORM
- Vercel deployment with auto-deploy from `main`

---

[Unreleased]: https://github.com/federicodecillia/porta_moneta/compare/v1.4.3...HEAD
[1.4.3]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.3
[1.4.2]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.2
[1.4.1]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.1
[1.4.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.0
[1.3.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.3.0
[1.2.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.2.0
[1.1.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.1.0
[1.0.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.0.0
