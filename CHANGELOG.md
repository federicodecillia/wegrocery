# Changelog

All notable changes to the WeGrocery app are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project loosely follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **Major** — breaking changes that require user re-onboarding
- **Minor** — new features, no breaking changes
- **Patch** — bug fixes, UI polish, documentation

Writing entries: one italic tagline under the version heading, then one bullet
per coherent change — a topical emoji, a **bold headline**, and at most two
lines saying what the user now sees. Implementation detail belongs in the PR.

> 🇮🇹 La versione italiana di questo file è [CHANGELOG.it.md](./CHANGELOG.it.md).
> Le due versioni devono restare sincronizzate.

---

## [1.8.0] — 2026-07-20

*Confirming an order now says so, and you can change your mind until the cycle closes.*

### Added
- ✅ **Confirming an order opens a proper confirmation.** A dialog recaps what was sent and when you can still change it, instead of a toast that slid away after a second.
- 📋 **Your confirmed order greets you when you come back.** The order page opens on a recap of what's on file — products, quantities, total, balance after — rather than dropping you back into the product list.
- ✏️ **Edit or cancel any time until the cycle closes.** Both actions sit under the recap; cancelling asks for a confirmation and removes the order so nothing is charged at closing.

### Changed
- 📰 **The changelog reads like release notes, not a report.** Short bullets with a topical emoji, a one-line summary per release, and category chips you can scan.
- 🔔 **The closing reminder can arrive up to ~3 hours before a cycle closes** (was exactly 2). The scheduled job doesn't run at perfectly regular intervals, and the wider window stops it skipping a cycle.
- 🤝 **Choosing a supplier is now required when opening a cycle**, so a cycle can no longer close without one.
- 🔤 **Nothing renders below 10px any more.** 55 micro-labels across the admin and member views were raised. Verified at 375px: nothing overflows.

### Fixed
- 🤝 **The supplier can now be set or corrected on a closed cycle.** The field used to vanish at closing, permanently stranding any cycle created without one.
- 🔒 **An order confirmed the instant an admin closes the cycle can no longer slip through uncharged.** Saving locks the cycle inside the same transaction, so a simultaneous close waits for the save, or the save is cleanly rejected.
- 🛡️ **Deactivated accounts can no longer act through a still-open session.** Orders and admin actions re-check the active flag on every request, and quantities are validated before anything is written.
- 🌍 **The Guide's "What's new" box follows the app language.** English deployments were showing the Italian teaser.
- 🎨 **The 404 page is translated and uses the group's colours.** Both error pages had hardcoded colours, on exactly the pages that bypass the themed layout.
- 🗣️ **The last Italian strings on English deployments** — the order-rectification notification and the negative-balance warning — now follow the app language.

---

## [1.7.0] — 2026-07-10

*Notification preferences with an email channel, and a guided import of the supplier's own price list.*

### Added
- 🔔 **Per-member notification preferences, with email as an optional channel.** Bell → ⚙ lets everyone choose app and/or email per category. Two new events ship with it: a cycle opening, and a reminder before closing for members who haven't ordered yet.
- 📥 **Guided import of a supplier price list.** A three-step wizard reads the supplier's own `.xlsx` or `.csv`, detects the header row and the supplier, lets you map whatever it couldn't recognise, then previews every row before writing anything.
- 📦 **"Catalogue in preparation" empty state** in the order form, so an open cycle with no products yet no longer looks broken.
- 🔒 **A 10 MB cap on admin uploads**, checked before the file is decoded, plus a decompression-bomb guard on `.ods` parsing.
- 🗄️ **Unique indexes on order lines and per-cycle products**, so concurrent imports can't slip duplicates past the app-side checks (migration `0008`).
- 🧪 **Tests for the money-adjacent pure functions** — shipping split, changelog parser, header heuristics, spreadsheet number parsing. Suite up to 78.

### Changed
- 📅 **Easier pickup entry.** The second pickup is optional behind a toggle, and times come from a 15-minute dropdown, so 19:30 is always selectable instead of being rejected as invalid.
- 📤 **The completed order sheet can be uploaded as `.ods` or `.csv`** too. With `.csv`, which can't carry the hidden mapping, names are matched and anything ambiguous is flagged and skipped — never guessed.
- ✏️ **The two rectification paths in the order recap are now distinct** — ✎ Prodotti for quantities, a per-line ✎ for actual weight or price — with a hint that works on a phone, where there is no hover.
- 🖥️ **Tidier "Carica prodotti" row** in Admin → Prodotti: the destination-supplier dropdown gets its own labelled line and the three actions stay readable on mobile.

### Fixed
- 🍆 **Wrong auto-suggested emojis** for aubergine, rice and peppers — overlap bugs in the first-match-wins table, now pinned by regression tests.
- 🛒 **Saving an order is atomic.** Delete and insert used to be two independent requests, so an interruption between them could silently leave the order empty.
- 🌍 **Corrupted uploads show a localized error** instead of the parsing library's raw English, and the last three hardcoded Italian admin strings follow the locale.
- 📱 **Open-cycle action buttons no longer run off the screen**, and the pickup date/time rows wrap on narrow phones. Verified down to 320px.

---

## [1.6.0] — 2026-05-21

*Supplier sheets that make the round trip, per-line rectifications, and real analytics.*

### Added
- 🔄 **A supplier sheet that comes back.** 📧 Fornitore sends an `.xlsx` laid out the way suppliers already work — products as rows, members as columns, live totals — and 📤 Carica distinta reads the returned file, previews the diff, and applies both line corrections and per-member shipping.
- ⚖️ **Record what was actually delivered, line by line.** Tap an order line to enter the real quantity and cost (1 kg ordered, 800 g received); the delta posts as a correction and the member is notified.
- 📊 **Filters in Admin → Statistiche** by cycle, supplier or member, combinable, with a one-click reset.
- ✏️ **Edit a cycle after it's closed** — title, notes, pickup dates, shipping — without reopening it.
- 🚚 **Shipping recomputes automatically on closed cycles**, and every affected member gets a notification showing the old and new share.
- 📧 **Send the order to the supplier by email**, with the acting admin and the shared GAS archive in CC and a per-product CSV attached.
- 🧾 **Shipping is visible in the order recap**, so the totals on screen match what members were actually billed.
- 💾 **Weekly off-site database backup to Google Drive**, complementing Neon's 7-hour point-in-time history.

### Changed
- 🤝 **Every supplier action lives in one 🤝 Fornitore dialog** — download, email, upload — and a single canonical workbook now circulates everywhere instead of divergent formats.
- 💰 **Admin → Cassa leads with three summary cards**, including a clickable "Saldo < 0" filter that used to be buried in Admin → Ciclo.
- 📈 **The Admin → Ciclo cards became a timeline**: Aperti / In scadenza (≤7 days) / Chiusi (last 7 days).
- 📊 **Statistics filters are multi-select** with a search box, and a filtered view is still shareable by link.
- 📄 **The product template is an Excel file** with one pre-filled example per common category; the importer still accepts `.csv`.
- 🧾 **Admin → Ordini totals include rectifications and shipping**, so each member's row matches what they were actually charged.
- 📱 **Cleaner "Ultimi cicli" on mobile** — the status pill moved left so it reads as a label, and the actions wrap underneath.
- 🏷️ **"Fatturato" renamed to "Spesa"** across the statistics, and it now folds in shipping.
- 📋 **One consistent `qty × price = total` line format** in the recap, with rectified rows showing ordered against actual.

### Fixed
- 📊 **Statistics crashed when filtering by cycle or supplier.** The Neon HTTP driver doesn't serialize JS arrays as Postgres arrays, so the filter never bound; the query now uses `inArray()` everywhere.
- 🔤 **Supplier sheets sort alphabetically and case-insensitively**, each sheet by the key that matches how it's actually read.
- 📋 **Order lines no longer read `1 1 × €2,00`.** A legacy "Unità" field stored as the literal string "1" is now treated as no unit.

---

## [1.5.0] — 2026-05-17

*Fix a member's order after the cycle has closed.*

### Added
- ✏️ **Edit a member's order after closing** — change quantities, add products, or build an order from scratch for someone who didn't originally take part. For the "I forgot to put the eggs in your bag" case.
- 🧾 **Corrections never touch the original charge.** The delta posts as a separate `correction` entry, so the audit trail stays intact and any change can be reversed.
- 🔔 **The member is notified** with a readable diff and their new balance.

---

## [1.4.5] — 2026-05-17

*One mobile fix.*

### Fixed
- 📱 **The admin's open-cycle buttons no longer overflow on phones.** Below 640px they stack under the title instead of clipping the last action.

---

## [1.4.4] — 2026-05-17

*One cosmetic fix.*

### Fixed
- 🏷️ **Dropped the dangling "/1" after prices** everywhere. It came from a legacy "Unità" field that was hidden from the form but still rendered.

---

## [1.4.3] — 2026-05-17

*A simpler, better-explained product form.*

### Added
- ⚖️ **Optional reference price-per-kg** on every product, shown to members next to the unit price wherever a price appears.
- ❓ **Inline help on every field of the product form**, one line and one example each.

### Changed
- 📝 **The product form lost the "Unità" field.** It duplicated the format string and confused admins.
- 🗂️ **Category is a dropdown now** — preset categories merged with whatever the supplier already uses, plus an inline "add new".
- 📄 **The CSV template follows the new column layout**; the importer still accepts the old one.

---

## [1.4.2] — 2026-05-17

*Pick an emoji, and start from the real balances.*

### Added
- 😀 **A searchable emoji picker** for the product icon, filtered by Italian keywords, replacing the free-text field.

### Changed
- 💰 **Member balances reset to match the legacy CASSA spreadsheet** ahead of going live, one seed entry per member.

---

## [1.4.1] — 2026-05-14

*The changelog moves into the app.*

### Added
- 📰 **A "What's new" page at `/changelog`**, linked from the Guide, with its own IT/EN toggle.
- 👀 **A teaser of the latest release inside the Guide**, linking to the full page.

### Changed
- 📄 **The supplier CSV is itemized per member** and sorted supplier → product → member, so it can be used directly to prepare each bag.
- 🧮 **Subtotal rows removed from the supplier CSV**, so nothing can be double-counted by summing both.

---

## [1.4.0] — 2026-05-14

*Numbers for the admin.*

### Added
- 📊 **An analytics dashboard** in the admin panel: top products, revenue trend over the last 12 closed cycles, supplier ranking, member participation, plus four overview cards.
- 📈 **Insight cards on the admin home** for cycles closing soon, negative balances and the 30-day best seller, each deep-linking into the right tab.
- 📄 **Supplier CSV export** from the closed-cycle modal, in the layout Italian Excel expects.
- 📚 **An English README** with architecture notes.

---

## [1.3.0] — 2026-05-10

*Repeat your last order in one tap.*

### Added
- 🔁 **"Repeat last order"** prefills the cart from your most recent order, matched by product identity. Only offered when the cart is empty, so it can't overwrite work in progress.
- 📅 **A "Next pickup" card** on the home page with the day, time window, supplier and a days-until counter.

### Performance
- ⚡ **Indexes on `products.cycle_id` and `ledger_entries.cycle_id`**, both queried on every admin and order page load.

---

## [1.2.0] — 2026-05-10

*Shipping splits and weight-based price adjustments.*

### Added
- 🚚 **Proportional shipping split** as an alternative to flat per-member, with rounding drift absorbed deterministically so the total stays exact to the cent.
- ⚖️ **Close a cycle with price adjustments** for weight-based items: edit each final unit price and every order line and ledger entry is recomputed before charges are posted.
- 📚 **SETUP.md**, a step-by-step local-development guide covering the `vercel env pull` gotchas.

### Fixed
- 🗄️ **`drizzle-kit push` reads `.env.local`** via Node's `--env-file`. It used to load only `.env` and fail silently with an empty url.

---

## [1.1.0] — 2026-05-10

*Hardening the cycle-close path.*

### Fixed
- 🔒 **Race condition on cycle close (critical).** Closing is now an atomic compare-and-swap, so two admins clicking at once can no longer post duplicate charges.
- 🛒 **Closing a cycle mid-order gives feedback.** The order form refreshes with a toast instead of failing silently.
- 🧾 **Negative balances are red on the Movimenti tab**, matching the home page.
- 🔔 **The cycle-close notification mentions shipping** and deep-links to that cycle in the history.
- 🖼️ **The header logo links back home.**
- 📱 **The bottom nav respects the iPhone home-indicator safe area.**
- 🗂️ **Uncategorized products group under "Altro"** instead of rendering an unlabeled section.

---

## [1.0.0] — 2026-05-05

*First production release of the Next.js rewrite.*

### Added
- 🚀 **The Next.js 15 rewrite goes live**, migrating the group off Apps Script.
- 🛒 **The member app**: balance, order form with per-product steppers, order and movement history, in-app notifications, FAQ guide.
- 🛠️ **The admin panel** with six tabs — cycles, products, orders, cash, members, suppliers.
- 🔒 **Google OAuth via Auth.js**, with an email whitelist on the members table.
- 🗄️ **Neon Postgres and Drizzle ORM**, deployed on Vercel with auto-deploy from `main`.

---

[1.8.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.0
[1.7.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.7.0
