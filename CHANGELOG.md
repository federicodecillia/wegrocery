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
- **Guided import of a supplier listing into a cycle.** A new **📥 Importa listino** button on each open cycle opens a three-step wizard that accepts the supplier's own `.xlsx` or `.csv` file (free format, one row per product). The wizard sniffs the header row, suggests a supplier match from the filename or a "Fornitore:" cell (with an inline "create new supplier" option when nothing matches), then lets the admin map any columns it couldn't auto-detect (Nome and Prezzo are required, everything else optional). The final step shows a row-by-row preview where the admin can deselect rows, override the auto-suggested emoji (rows without a category match are flagged in red), and see each product's category — taken from the file when present, otherwise guessed from the product name among the preset categories (Frutta, Verdura, Carne, …) and tagged "auto". The admin can also choose whether to update prices for products already in the catalogue, and confirm whether the same rows should also be added to the open cycle. The same wizard is also reachable from Admin → Fornitori → Catalogo, where it imports into the catalogue only.

### Changed
- **Easier pickup entry in the cycle form.** The second pickup is now optional and hidden by default behind an **➕ Aggiungi secondo ritiro** toggle, so you only fill it in when there actually is one. Pickup times are now picked from a 15-minute-slot dropdown instead of a free time field, so half-hour times like 19:30 are always selectable and can no longer be rejected as "invalid".
- **Clearer "Carica prodotti" buttons in Admin → Prodotti.** The destination-supplier dropdown now sits on its own labelled row instead of being squeezed to a sliver by the action buttons. The three actions were shortened and given consistent icons — "↓ Template", "↑ Carica file", "✨ Import guidato" — and now stay readable on both desktop and mobile.
- **Easier to find where to fix actual prices/weights in the order recap.** The two edit paths in Admin → Ciclo → Recap ordini are now distinct: the per-member button is labelled **✎ Prodotti** (add/remove products, change whole quantities) while each product line carries a small ✎ and a one-line hint at the top — "Tocca un prodotto per correggere peso o prezzo effettivo" — so the actual price/weight rectification (the 1 kg → 800 g case) is visible on the phone, where there is no hover or tooltip. The product-quantity editor also shows a teal note pointing back to the line tap when you only need to fix a price or weight.

### Fixed
- **Open-cycle action buttons no longer run off the screen.** In Admin → Ciclo the row of actions on an open cycle (Gestisci Prodotti, Importa listino, Modifica, Chiudi con rettifiche, Chiudi ciclo) could overflow past the right edge; it now wraps cleanly under the title. The pickup date/time rows in the cycle create/edit forms were also overflowing on narrow phones and now wrap the "Dalle/Alle" times onto their own line. Verified down to 320px wide.

---

## [1.6.0] — 2026-05-21

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
- **Admin → Cassa now leads with three summary cards.** Total balance across active members, average balance per active member, and a clickable "Saldo < 0" card that toggles a filter on the list below so you only see members in the red. The negative-balance card used to live in Admin → Ciclo where it was easy to miss; it now sits next to the other balance figures it belongs with.
- **Admin → Ciclo top-row cards are now a cycle timeline.** Three at-a-glance counters — Aperti / In scadenza (≤7 days) / Chiusi (last 7 days) — replace the old "Saldo < 0" and "Top 30 giorni" cards. The closing-soon window grew from 24 h to 7 days so the card is useful for planning, not just panicking.
- **Filters in Admin → Statistiche are now multi-select.** Each dropdown (cicli, fornitori, soci) lets you tick several entries at once with a built-in search box; selecting nothing means "tutti". All cards, charts and rankings adapt to the combined filter. URL params switch from a single id to a comma-separated list, so a filtered view is still shareable by link.
- **Admin → Prodotti template is now an Excel file (`.xlsx`).** One example per common GAS category — Frutta, Verdura, Pane e cereali, Pasta e riso, Latticini, Uova, Carne, Conserve, Olio e aceto — comes pre-filled in italic so you can adapt them in place. The import button now accepts both `.xlsx` and the older `.csv` format.
- **"Riepilogo ordini" in the supplier `.xlsx` is now sorted by product, then variant.** Previously rows were grouped by member, which made it harder for the supplier to scan the totals for a given product. The matrix (Distinta sheet) is unchanged.
- **Cleaner "Ultimi cicli" layout on mobile.** The "Chiuso" pill moved to the left of the cycle name so it reads as a status label, not a button. The three action buttons (Modifica, Fornitore, Ordini) now wrap on their own row underneath instead of squeezing next to the title. "Modifica ciclo" renamed to just "Modifica".
- **Excel download buttons all say "Scarica Excel"** now (admin → Fornitore hub and admin → Ordini), instead of the technical "Scarica .xlsx".
- **🤝 Fornitore button no longer disabled when the supplier has no email on file.** Even without a pre-filled recipient the dialog is useful — the admin can type the address by hand for that single send, and the download xlsx + carica distinta sections are independent of email configuration. The button stays disabled only when the cycle has no supplier at all.
- **All supplier actions consolidated into a single 🤝 Fornitore dialog.** The closed-cycle row now has three buttons, in this order: `✎ Modifica ciclo`, `🤝 Fornitore`, `✎ Ordini`. The new hub dialog hosts every supplier interaction in one place: 📥 Scarica riepilogo ordini (the canonical xlsx), 📧 Invia per email (the same 4 editable fields as before — Destinatario/Mittente/CC/Oggetto), 📤 Carica distinta compilata (the file upload + diff preview + apply). The old "Carica distinta" and "CSV fornitore" buttons inside Recap ordini are gone — they lived in the wrong place. The Admin → Ordini "Esporta CSV" now downloads the same xlsx as the hub (one file circulates, no more divergent formats).
- **One canonical xlsx file** circulates: the email attachment, the hub download, and the Admin → Ordini export all produce the same workbook. It now has three sheets: `Distinta` (the editable matrix, unchanged), `Riepilogo ordini` (read-only, one row per socio×prodotto with Qta ordinata · Prezzo unitario · Totale), and `Totali per prodotto` (read-only aggregation). Hidden `_meta` sheet for round-trip import is unchanged.
- **Ordered quantity shown as cell note in the supplier xlsx.** Hovering over a yellow cell in the `Distinta` sheet now shows "Ordinato: 2 pz" (or the relevant unit), so the supplier knows the reference quantity without polluting the editable cell value.
- **Consistent line format in Recap ordini.** Rectified lines used to read `1 = €2,55` while non-rectified read `1 × €1,50 = €1,50`. Both now use the same `qty × unit_price = total` format; rectified rows show a struck "ordinato" line above a bold "effettivo" line, with the effective unit price derived from the actual total / actual quantity.
- **📧 Fornitore confirm replaced with an editable dialog.** Clicking the button used to pop a one-paragraph confirm where Destinatario / Oggetto / CC ran into each other. Now it opens a proper compact form: each header field (Destinatario, Mittente, CC, Oggetto) is on its own line, in 12 px monospace, and freely editable for that single send. Defaults are pre-filled from the cycle's supplier email + `MAIL_FROM` + the acting admin + `gas@portamoneta.org`. CC accepts comma-separated emails. The Mittente note clarifies that the From must be a domain verified in Resend.
- **Admin → Ordini totals now include rectifications and shipping.** The per-socio figure used to show the original product subtotal even after the admin had rectified delivered weights or added a shipping charge — Chiara's row read €3,75 when she had actually been charged more. The "Per socio" section is now first (it's the more useful view), and totals reflect the effective amount: `actual_line_total` where set, plus the member's `shipping_charge` ledger entries. The "Per prodotto" section follows underneath, showing product subtotals at the post-rectification price (shipping is excluded there because it isn't tied to a product).
- **"Fatturato" renamed to "Spesa"** throughout Admin → Statistiche — top card label, trend chart title, supplier ranking heading. "Spesa totale" now also folds in shipping so it matches what the soci actually paid, not just the product subtotals.
- **Admin → Ordini CSV export now matches the "CSV fornitore" file** produced inside the "Vedi ordini" modal: same header (`Fornitore;Prodotto;Varietà;Formato;Unità;Socio;Quantità;Prezzo unitario;Totale (€)`), same supplier-grouped layout, same Italian decimal-comma + UTF-8 BOM for Excel. Single shared client-side builder so the two surfaces can't drift again.

### Fixed
- **Admin → Statistiche server error when filtering by ciclo or fornitore.** Selecting a cycle or supplier filter crashed the page with a generic "Qualcosa è andato storto" because the underlying SQL used Postgres `= ANY($1::text[])` to bind the multi-select arrays — but the Neon HTTP driver doesn't serialize JS arrays as Postgres arrays, so the parameter never bound. Member filtering happened to bypass the broken path. Now the analytics query uses Drizzle's `inArray()` everywhere, which expands to a plain `IN (?, ?, ...)` with one placeholder per element.
- **Supplier .xlsx now alphabetical across every sheet, each with its own sort key — and case-insensitive.** The `Distinta` matrix and `Totali per prodotto` used to follow each product's `sortOrder` field, which could be set arbitrarily and rarely matched the order suppliers expected. The three read-only sheets are now sorted to match how each is actually read: `Distinta` and `Totali per prodotto` by product name then variant, `Riepilogo Ordini Soci` (renamed, was "Riepilogo ordini") by socio then product then variant so everything a single member ordered sits in one block. Sorts are case-insensitive (`LOWER()` in Postgres, `sensitivity: "base"` in JS) so a product called "aglio" no longer ends up at the bottom of the sheet after "Zucchina". Same workbook regardless of where you download it — 🤝 Fornitore hub, the email attachment, or Admin → Ordini.
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

[Unreleased]: https://github.com/federicodecillia/porta_moneta/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.6.0
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
