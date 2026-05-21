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

### Added
- **Round-trip "distinta fornitore" `.xlsx`.** When you press 📧 Fornitore the email now carries an Excel workbook laid out exactly the way suppliers already use: products as rows, members as columns, yellow cells pre-filled with the original prices, a "Spedizione" row at the bottom and live `=SUM(...)` totals per member and per product. Reference columns (prodotto/varietà/formato/€/pz/€/kg/note) are locked so the structure can't be broken accidentally. A hidden `_meta` sheet carries the cycleId + product/member mappings so the file can be re-imported without name matching. After the supplier weighs everything and returns the file, the new **📤 Carica distinta fornitore** button inside "Vedi ordini" reads it, shows a diff preview (rettifiche riga, spedizione per socio, eventuali avvisi) and on confirm applies everything — line corrections go through the same `correction` ledger flow as the manual rectification, while per-member shipping is written directly to the ledger and the cycle is flipped to `shippingMode = "manual"` so future edits don't overwrite it. The cycle form shows an orange banner instead of the shipping inputs when in manual mode. Format opens in Excel, LibreOffice, and Google Sheets without conversion.
- **Shipping is now visible in the "Vedi ordini" modal.** Each member's section in Admin → Ciclo → Recap ordini now shows a 🚚 Spedizione row under their product lines, and the per-member subtotal at the top includes it. Before this, the modal only listed product lines, so the totals on screen didn't match the actual `order_charge + shipping_charge` the member was billed.
- **Filters in Admin → Statistiche.** Three dropdowns at the top of the analytics dashboard let you filter every card and chart by ciclo, fornitore, or socio (combinable). A "Rimuovi filtri" link clears them in one click. Useful for answering "how much did supplier X bring in over the last 3 cycles?" or "what did Chiara order this year?".
- **Weekly off-site database backup to Google Drive.** A GitHub Actions workflow runs every Sunday at 03:00 UTC, dumps the Neon production database with `pg_dump`, gzips it, and uploads it to `gdrive:PortaMoneta/GAS-Backups/` via rclone. This complements Neon's free-tier 7-hour point-in-time history so we can restore from up to a week-old snapshot if data is lost or corrupted. Setup and restore procedure documented in the project `CLAUDE.md`.
- **Edit a cycle after it's been closed.** Closed cycles in the "Ultimi cicli" list now have a ✎ Modifica button alongside "Recap ordini". Admins can fix the title, notes, pickup dates, and shipping costs without reopening the cycle. The form clearly disables what doesn't make sense to change post-closure (order close time, supplier, access level).
- **Automatic shipping recompute on closed cycles.** When an admin changes the shipping mode or amount on a closed cycle, the `shipping_charge` ledger entries are updated in place for every member with an order. Each affected member receives an `order_adjusted` notification showing the old and new share, and a `cycle_shipping_recomputed` audit log entry records the before/after.
- **Send the order to the supplier by email.** New 📧 Fornitore button on each closed cycle. It sends a Resend-powered email to the cycle's supplier with the acting admin **and `gas@portamoneta.org` (the shared GAS archive)** in CC, plus a CSV attached, aggregated per product (one row per SKU with summed quantities and totals). Disabled with an explanatory tooltip when the cycle has no supplier or the supplier has no email on file. Resend setup is documented in `SETUP.md`.
- **Record what was actually delivered, per line.** Inside the "Recap ordini" modal each order line is now clickable: the admin can enter the real delivered quantity and cost (e.g. ordered 1 kg of beetroot, received 800 g → €1.60 instead of €2.00). The delta is posted as a `correction` ledger entry, the member's saldo updates immediately, and they get an `order_adjusted` notification with the diff. Lines that have been rectified are tagged "rettificato" and show ordered-vs-actual side by side.

### Changed
- **Admin → Ordini totals now include rectifications and shipping.** The per-socio figure used to show the original product subtotal even after the admin had rectified delivered weights or added a shipping charge — Chiara's row read €3,75 when she had actually been charged more. The "Per socio" section is now first (it's the more useful view), and totals reflect the effective amount: `actual_line_total` where set, plus the member's `shipping_charge` ledger entries. The "Per prodotto" section follows underneath, showing product subtotals at the post-rectification price (shipping is excluded there because it isn't tied to a product).
- **"Fatturato" renamed to "Spesa"** throughout Admin → Statistiche — top card label, trend chart title, supplier ranking heading. "Spesa totale" now also folds in shipping so it matches what the soci actually paid, not just the product subtotals.
- **Admin → Ordini CSV export now matches the "CSV fornitore" file** produced inside the "Vedi ordini" modal: same header (`Fornitore;Prodotto;Varietà;Formato;Unità;Socio;Quantità;Prezzo unitario;Totale (€)`), same supplier-grouped layout, same Italian decimal-comma + UTF-8 BOM for Excel. Single shared client-side builder so the two surfaces can't drift again.

### Fixed
- **Cleaner order-line display in the "Vedi ordini" modal.** Lines used to read like `1 1 × €2,00 = €2,00` because the legacy "Unità" field was stored as the literal string `"1"` on many products and got concatenated next to the quantity. The bogus `"1"` is now treated as "no unit" everywhere it surfaces in the modal (rectification view included), so the line reads `1 × €2,00 = €2,00`. When the product has a reference price-per-kg, it's now shown under the unit price (e.g. `€5,00/kg`).

---

## [1.5.0] — 2026-05-17

### Added
- **Edit a member's order after the cycle is closed.** Inside the "Recap ordini" modal each member row now has a ✎ Modifica button that opens a full stepper UI: change quantities, add products from the cycle catalog, remove lines, or even create an order from scratch for a member who didn't originally participate ("+ Aggiungi ordine per un socio" at the bottom of the modal). Designed for the common "I forgot to put the eggs in your bag" scenario.
- **Correction ledger entries.** Edits never touch the original `order_charge` row. Instead, the delta between the old and new order total is posted as a separate `correction` entry (negative = additional charge, positive = refund), so the audit trail stays intact and any change is fully reversible by posting an opposite correction.
- **Member notification on edit.** The member gets an `order_corrected` notification with the human-readable diff and their new balance, deep-linking back to the cycle in `/storico`.

---

## [1.4.5] — 2026-05-17

### Fixed
- **Admin open-cycle action buttons no longer overflow on mobile**. The row "Gestisci Prodotti / Modifica / Chiudi con rettifiche / Chiudi ciclo" used to spill outside the card on iPhone-sized screens — the last action ("Chiudi ciclo") was clipped off. On screens narrower than 640px the buttons now stack under the title and wrap onto a new line as needed; on tablet/desktop they keep the previous side-by-side layout.

---

## [1.4.4] — 2026-05-17

### Fixed
- **Removed the dangling "/1" suffix next to product prices** everywhere — home order summary, order form, history, admin catalog and cycle views. The suffix came from the legacy "Unità" field (often set to the literal string "1") which v1.4.3 removed from the UI but kept rendering as a noisy `/1`. Now prices read as `€2,00` (or `€2,00 (€4,00/kg)` when a kg reference is set), without the trailing slash.

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

[Unreleased]: https://github.com/federicodecillia/porta_moneta/compare/v1.5.0...HEAD
[1.5.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.5.0
[1.4.5]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.5
[1.4.4]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.4
[1.4.3]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.3
[1.4.2]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.2
[1.4.1]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.1
[1.4.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.0
[1.3.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.3.0
[1.2.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.2.0
[1.1.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.1.0
[1.0.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.0.0
