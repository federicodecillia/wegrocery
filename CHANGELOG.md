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

## [Unreleased]

### Fixed
- 🗑️ **Deleting a member who never ordered works again.** Admin → Members could not delete an account that had received a notification (almost every new account gets the open-cycle one) and showed a database error; now the account and its notifications go.

## [1.21.1] — 2026-10-04

*Notes that members can read, and a member list that fits on a phone.*

### Fixed
- 📝 **Notes reach the members.** The notes an admin writes on a cycle now appear on Home and at the top of the order page, and each product's notes under its name in the order form and the recap. Before, only admins saw them.
- 📱 **Member list readable on phones.** In Admin → Members the email addresses no longer run under the buttons: the list shows name, last sign-in and actions, the addresses are in the edit form, and on narrow screens the buttons sit below the name.

## [1.21.0] — 2026-10-03

*Sign in with a code from the email, and the app on your phone's home screen.*

### Added
- 🔢 **Sign in with a code too.** The sign-in email now also carries a 6-digit code: type it on the sign-in page when the link opens in the wrong browser or on another device. Same 15 minutes as the link, three tries per code.
- 📱 **Install the app on your phone.** On a phone the home page offers to add the app to the home screen (the install button on Android, the steps on iPhone), with icons drawn from your group's logo; the Guide explains it too.

### Fixed
- 🧩 **The app description is reachable again.** It sat behind the sign-in: a browser asking for it without the session (always, on the sign-in page) got the sign-in page instead, so the app did not install properly.

## [1.20.0] — 2026-10-01

*Notification settings that say what they cover, a Cassa that names every movement, and Next.js 16 underneath.*

### Changed
- 🔔 **Clearer notification preferences.** The four groups now say what they cover: new cycle opened, charges and payments (including the settlement and online payment confirmations), order changes (including a cancelled cycle) and balance and refunds. Your saved choices are kept; payment confirmations now follow "Charges and payments".
- 🧰 **Next.js 16 and TypeScript 7.** Same app, newer foundations; self-hosters need Node.js 20.19 or later, and lint now runs with `npm run lint`.
- 🌙 **A sturdier nightly check.** The nightly money check no longer waits for the backup, and a failed or stuck night opens a GitHub issue.

### Fixed
- 🏷️ **Cassa names every movement.** Older card refunds and payments, shipping and corrections showed a raw code such as `ORDER_REFUND` in the movement badge; they now read "card refund", "order payment", "shipping" and so on, and an unknown type shows a plain "movement".
- ✏️ **Editing a cycle after it closed.** Saving a cycle's title or pickup from a form that was opened before the close no longer fails with "the fee can no longer change" when the fee is untouched.
- 👥 **Closed-cycle details list every charged member.** A member charged shipping or the order preparation fee but left with no order line now appears in the list, so the members shown add up to the total.
- 💬 **Clearer credit message.** The balance card now says the difference you paid is your credit; two admin messages also state the fee cap in euros in English.

## [1.19.0] — 2026-10-01

*Install it for your own group in half an hour, and an order preparation fee that is a real, checked charge.*

### Added
- 🚀 **Run it for your group.** A step-by-step guide (`docs/self-hosting.md`) with a Deploy to Vercel button that creates the project and its Neon database and applies every migration at the first build; `docs/brand.example.json` lists every brand field.
- 👑 **First admin of a new installation.** The address in `BOOTSTRAP_ADMIN_EMAIL` becomes admin at its first sign-in, only while the group has no admin; Configuration status says when the variable can go.
- 🧾 **Order preparation fee.** A cycle can charge a fee for bank fees and running costs, in both payment modes: a percentage of the products or a fixed amount per member, up to 25% or €10. Members see it before ordering; it is charged at the close as its own movement and checked every night. Upgrade note: apply `drizzle/0026_handling_charge.sql` right before deploying when `MIGRATE_ON_BUILD` is off.

### Changed
- 💳 **Pay per order: the fee is a cost, not an estimate.** The group keeps it; settlement evens out products and shipping only. With proportional shipping each member pays their share at settlement.
- 🩹 **New installations no longer fail on the home page.** Three cycle columns were missing from the migrations; one more migration adds them (a no-op on existing installations). A CI test now compares the whole schema with a migrated empty database. Upgrade note: apply `drizzle/0025_schema_catch_up.sql`.
- 🧭 **Configuration status spots brand mistakes.** A brand field the app does not know (a typo) or a brand that does not parse shows up, with the reason, in Settings and in `npm run doctor`.
- 🏗️ **Migrations at build on production only.** With `MIGRATE_ON_BUILD=true` preview builds no longer migrate: only production builds (and builds outside Vercel) do.

## [1.18.0] — 2026-10-01

*Pay each order by card, settle accounts after the cycle, and a ledger that never rewrites history.*

### Added
- 💳 **Pay per order, selectable.** Admins can switch the group to paying each order by card in Settings, once no cycle is running; the card lists what stops the change and the balances before confirming. Upgrade note: apply `drizzle/0024_settlement.sql` before deploying; pay per order needs euros and a usable Stripe key.
- 🧮 **Settle accounts.** On a closed or cancelled pay-per-order cycle, "Settle accounts" refunds to the card what each member paid beyond the final costs, asks for what is missing and writes off differences under €0.50. The cycle shows where it stands: to settle, refunds in progress, settled, out of date, refund failed.
- 🔴 **Amount due and credit.** When costs went beyond what a member paid, Home and the balances page show "Amount due" with "Pay now"; new order payments wait until it is paid. A credit shows as money the association gives back.
- 🧾 **Pays outside the app.** In pay-per-order an admin can mark a member who pays in cash: they confirm orders without the card, the treasurer records the money, and the settlement leaves them out.
- 📚 **History and guide for pay per order.** Each cycle in History shows what was paid, the costs, the refunds and the net; the guide and FAQ explain the handling share, the settlement and refund times.

### Changed
- 🧾 **Corrections never rewrite history.** Editing or deleting a movement in Treasury, recomputing shipping on a closed cycle or importing the supplier's sheet now cancel the movement with a reversal and, when needed, add the corrected one; members see one movement marked "corrected on". Upgrade note: apply `drizzle/0023_ledger_append_only.sql` right before deploying (it makes the database refuse changes to past movements).

## [1.17.0] — 2026-09-30

*Sign in with an email link, and the groundwork for paying each order.*

### Added
- ✉️ **Sign in with an email link.** Type your address and you get a link that signs you in, no Google account needed; Google stays for whoever prefers it. Admins can send the link as an invitation from Members, and see each member's last sign-in. Upgrade note: apply `drizzle/0022_auth_sessions.sql` before deploying; email (Resend) must be set up; everyone signs in once more after the update; the Google redirect URI does not change.
- 🧮 **Nightly check of the books.** After the backup, a read-only check makes sure every payment, refund and charge adds up, and fails loudly if not.
- 🧭 **Configuration status.** Settings shows what this installation has connected (database, sign-in, email, payments...) and what is missing, by name only; `npm run doctor` prints the same. Upgrade notes per version are in `docs/upgrading.md`, and `MIGRATE_ON_BUILD=true` applies migrations at every production build (optional).
- 💳 **Pay per order, groundwork.** The app can now take an order's payment with Stripe, refund it when the order is cancelled or the payment arrives after the close, and retry a refund from Treasury. Not selectable yet: it becomes an option in Settings with the settlement. Upgrade note: apply `drizzle/0021_pay_per_order.sql` before deploying; no new variables, no new Stripe events.

### Changed
- 🔕 **No email by default when a cycle opens.** New members get the "cycle open" notice in the app only and can turn the email on in their preferences; members who already chose keep their choice.

## [1.16.1] — 2026-09-30

*A desktop layout, and the groundwork to watch the app's health.*

### Added
- 🩺 **Health check and optional error reporting.** `/api/health` says whether the app and its database answer, and server errors can go to Sentry. Upgrade note: no migration; `SENTRY_DSN` is optional, without it nothing changes.

### Changed
- 🖥️ **A proper desktop layout.** On a computer the menu moves to the top and the pages keep a comfortable reading width; only Admin uses the wider window, and Treasury shows the forms next to the member balances.
- 🔤 **Slightly larger reading text.** Descriptions and lists in the member pages go from 13 to 14 px.
- ✉️ **Your email, out of the way.** On a phone it no longer takes a line under the logo: you find it on the Notifications page.

## [1.16.0] — 2026-09-30

*Text you can read, in any group's colours.*

### Changed
- 👓 **Text you can read.** Buttons, links, labels and amounts now have enough contrast on every screen: dark text on the coloured buttons, darker shades for coloured and grey text, a deeper red for negative amounts.
- 🎨 **Colours that follow the group's palette.** Text colours are worked out from the brand colours, so a group with a different palette stays readable. Upgrade note: nothing to do; theme colours must be hex (`#rgb` or `#rrggbb`), anything else falls back to the default palette with a `[brand]` warning in the logs.
- 🔎 **Nothing smaller than 12 px.** Labels, badges and captions that were 10 or 11 px are now 12 px, and on a phone the form fields no longer zoom the page when you tap them.

### Fixed
- 💶 **Balance on one line.** On Home the balance no longer wraps after the sign in English formats.

## [1.15.0] — 2026-09-30

*Card refunds you can follow.*

### Added
- ⚠️ **Refunds that do not go through.** If a card refund fails after it was sent, the amount goes back on the balance, History shows "Refund failed", and the member and the admins are told how it will be returned.

### Changed
- 💳 **Card refunds recorded one by one.** Every refund of an online top-up is recorded once, as soon as Stripe accepts it, even when it arrives in more than one step (migration `0020`).

## [1.14.1] — 2026-09-30

*Tidier amounts in Settings.*

### Fixed
- ⚙️ **Maximum balance with cents.** Settings shows a saved amount like 35,20 € with both cent digits, instead of 35,2.

## [1.14.0] — 2026-09-29

*Payment settings in the app, and orders that wait for you.*

### Added
- ⚙️ **Payment settings for admins.** A new Settings tab (gear icon) sets the group's overdraft limit, a maximum balance, and which top-up channels members see: bank transfer (holder and IBAN) and online payment. Until an admin saves, nothing changes (migration `0019`).
- 🛒 **Your order waits for you.** Changes to an order are saved as you go: leave the page and come back, even from another device, and they are still there, marked "Changes not confirmed yet" until you confirm or discard them.
- 🧾 **Movement details.** Tap a movement in History to see date and time, cycle, note, method and reference, the online payment's status and who recorded it.

### Changed
- 💶 **Top-ups respect the maximum balance.** Online top-ups offer only what fits, the bank details say how much you can still top up, and a member in debt gets the exact amount to pay it off as the first option.
- 🏦 **Treasury flags balances above the maximum.** A top-up recorded in Treasury is never refused, but the admin is told when it takes the balance past the maximum, and a new filter lists those members.

## [1.13.0] — 2026-09-29

*A fuller Cassa, and a history that adds up to the balance.*

### Added
- 💸 **Outgoing movements in Cassa.** Admins can record a balance paid back to a member (never beyond the balance), a manual charge or the membership fee, each with a reason the member reads in the notification.
- 🏦 **Manual top-ups with method and reference.** Search the member by name or email, pick the method (bank transfer, cash, Satispay, other) and add the CRO/TRN: a reference already used is refused, a similar top-up in the last days asks for confirmation, and a recap comes before saving (migration `0018`).
- 🧺 **Pick the cycle when more than one is open.** "Order" lists the open cycles with their supplier instead of opening the first one, and the countdown button on the home page opens its own cycle.

### Changed
- 📒 **History matches the balance.** Each cycle shows products (after weighing), shipping, corrections and the total charged to the balance, and every movement has a clear name and its own icon: Top-up, Shipping, Refund, Adjustment, Balance returned, Membership fee.
- ➕ **Amounts with their sign.** Balance and movements always show + or -, and a negative balance on the home page reads "To top up".
- 🚚 **Shipping follows edits to closed orders.** Editing a member's order after closing re-splits everyone's shipping on the actual totals (after weighing), unless it came from the supplier's sheet; only members whose share moved are notified.
- 🔐 **A deactivated member is signed out at once.** Deactivating a member, admins included, ends their session on the next request instead of at token expiry.

### Fixed
- 📧 **Emails and aliases are no longer shared between members.** Saving a member with an email or secondary email another member already uses, in any casing, is refused with that member's name (migration `0017`).
- ⚠️ **Readable error messages.** In production, expected refusals (cycle closed, missing field, order changed meanwhile) now show their own text instead of a generic error, and the order page reloads by itself when the cycle has closed.

## [1.12.2] — 2026-09-29

*Smaller online top-ups.*

### Changed
- 💶 **Online top-ups from 0,50 €**, the smallest amount Stripe accepts (was 20 €).

## [1.12.1] — 2026-09-28

*Clearer top-up details.*

### Changed
- 🏦 **IBAN in groups of four** on the Top up page, easier to check by eye; the copy button still copies it without spaces.
- 📖 **Guide and FAQ point to the Top up page** for bank transfers and online payment.

## [1.12.0] — 2026-09-28

*Top up your balance online.*

### Added
- 💳 **Online top-up.** A new "Top up" page (from the home balance card) lets members top up by card or the other methods the group enables, through a Stripe payment page. The balance updates by itself as soon as the payment is confirmed, and refunds made from Stripe show up in the history.
- 🏦 **Bank details on the same page.** When the group sets them, the page also shows holder, IBAN and payment reference for a bank transfer, each with a copy button.

### Changed
- 🔒 **Online payments stay tied to Stripe.** In Cassa, top-ups and refunds that came from an online payment can no longer be edited or deleted: the money moved on Stripe, so the fix is a refund there or a separate correction.

## [1.11.0] — 2026-09-28

*Open to every card-holding member, with safer money flows.*

### Added
- 🪪 **Members with an active membership card can sign in on their own.** The first Google login with the email used for the card checks it with the membership provider and creates the account; no admin whitelisting needed. Cards are rechecked before an order grows, and the login page explains what to do when access is refused.
- 💳 **Credit limit.** An order that would take the balance (counting orders still open on other cycles) below the group's limit is refused with the amount still available; lowering or cancelling an order always works.
- 🔐 **Privacy policy link** on the login page and in the footer.

### Changed
- 👥 **Roles and cycle access now share the same three names: Admin, Attivi, Utenti.** Admins see every cycle, Attivi see standard and private cycles, Utenti see standard cycles only. The member form no longer defaults an unrecognised role to Admin, and "enabled members" now names the on/off switch on an account.

### Fixed
- 🕰️ **Times follow Rome everywhere.** Closing and pickup times no longer shift by two hours between cards, forms and emails, a cycle stops taking orders at the hour it shows, and the switch to winter time on 25 October is handled.
- 🧾 **Editing a Cassa movement keeps its sign.** Changing only the note of a refund no longer turns it into a charge, and an empty amount is rejected instead of corrupting the balance. Order and shipping charges are corrected with a new entry rather than edited in place.
- ⚖️ **Editing a closed order keeps the weighed quantities**, so re-weighing afterwards can no longer refund a member twice.
- 🚚 **Saving a closed cycle keeps shipping imported from the distinta**, instead of resetting everyone's share and sending wrong notifications.
- 🔒 **Closing a cycle is all-or-nothing.** Charges, shipping and the status change are written together, and a second charge for the same cycle is rejected by the database.

### Security
- ⚡ **Next.js updated to 15.5.25**, patching two critical remote-code-execution advisories. One requires a Windows-hosted server (we run on Vercel/Linux); the other was in image optimization, already narrowed to the brand's own logo host. `sharp` moved to 0.35.4 alongside it.
- 📤 **A crafted supplier file could no longer stall a distinta import.** Re-importing a `.ods` re-save (e.g. from LibreOffice) used an XML parser with a denial-of-service bug on long runs of whitespace, now fixed.
- 📊 **A dormant advisory in the spreadsheet library, fixed anyway.** `exceljs` bundles an old, vulnerable `uuid`; unreachable here since the one call site never touches the vulnerable code path, but pinned to the patched release regardless.
- 🧹 **A development-only dependency** (`js-yaml`) with a denial-of-service advisory refreshed. It never shipped to users.

---

## [1.10.3] — 2026-09-06

*Same product, same shelf.*

### Fixed
- 🥕 **A product no longer splits across categories.** "Cicoria" (or any other product) now always lands in the same category no matter which variant or import batch it came from — the name-based guess wins over a supplier file's own inconsistent category column, everywhere products get loaded into an order.
- 🔤 **Products are actually sorted now.** The order screen (and every other product list) sorts alphabetically by product, then variety, then format and price, instead of whatever order the last import happened to load them in.

---

## [1.10.2] — 2026-08-30

*Fewer vegetables getting lost in "Other".*

### Fixed
- 🥬 **Products land in the right category more often.** A supplier file that labels most rows "Altro"/"Varie" no longer overrides a confident guess — a zucchina, a melanzana, a patata now sort into Verdura even when the supplier's own sheet didn't bother.
- 🌿 **More products get an automatic icon.** Basil, parsley, and other aromatic herbs — including compound names like "Basilico viola da trapiantare" — now get a matching icon instead of the generic cart. Plural forms (zucchine, carote, funghi, asparagi...) match too, and a handful of previously-unmapped items (pancetta, gamberi, calamari, mandarino, olive) now have one.

---

## [1.10.1] — 2026-08-27

*Making sure the supplier's inbox actually sees it.*

### Fixed
- 📬 **The supplier order email is less likely to land in spam.** Replies now go straight to the admin who sent it, the subject leads with your cooperative's name instead of the app's, and the message is sent as proper HTML alongside plain text — three signals spam filters use to trust a message.

---

## [1.10.0] — 2026-08-27

*A way back when a cycle goes wrong after it's already closed.*

### Added
- 🚫 **Cancel a closed cycle and refund everyone.** When a supplier fails to deliver on an order that's already been charged, an admin can now cancel that cycle: every member who was charged gets refunded in full (products, and shipping unless you opt out), with a mandatory reason and a full trail — a "cancelled" badge on the cycle, a marked movement in each member's history, an audit log entry, and a notification to each refunded member.

---

## [1.9.0] — 2026-08-07

*One notification fewer, and one moving part fewer behind it.*

### Removed
- 🔕 **The "cycle closing soon" reminder is gone.** It arrived in your notifications when a cycle was about to close and you hadn't ordered; the cycle-opened notification already tells you the closing date, so this was mostly a second copy of the same information.
- ⚙️ **Its toggle has left the notification settings.** One row fewer to read through; reminders you received in the past stay in your notification list.

---

## [1.8.1] — 2026-07-28

*Security patches for the login layer and the image pipeline.*

### Security
- 🔒 **Auth.js updated to the version that patches four advisories**, two of them critical (`next-auth` 5.0.0-beta.32, `@auth/core` 0.41.3). None were exploitable here — the app has no magic-link provider, never calls `getToken()`, has a single OAuth provider with no account linking, and every access check reads `session.user.email` rather than the truthiness of the auth object — but the fix is a patch-level bump, so there's no reason to sit on it.
- 🖼️ **The image endpoint no longer accepts any host on the internet.** It used to allow `https://**`, which in a self-hosted deployment turns `/_next/image` into an open proxy: anyone could have the server fetch arbitrary remote images and run them through the image library. It now allows exactly the brand logo's own URL, taken from the deployment's own configuration.
- ⚡ **Next.js updated to 15.5.22** for a denial-of-service fix in image optimization, and the image library forced to a build with the patched `libvips` (`sharp` 0.35.3), which upstream has not yet picked up.
- 🧹 **Two development-only dependencies** with denial-of-service advisories (`js-yaml`, `brace-expansion`) refreshed. They never shipped to users.

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

[1.21.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.21.1
[1.21.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.21.0
[1.20.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.20.0
[1.19.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.19.0
[1.18.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.18.0
[1.17.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.17.0
[1.16.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.16.1
[1.16.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.16.0
[1.15.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.15.0
[1.14.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.14.1
[1.14.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.14.0
[1.13.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.13.0
[1.12.2]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.2
[1.12.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.1
[1.12.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.0
[1.11.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.11.0
[1.9.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.9.0
[1.8.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.1
[1.8.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.0
[1.7.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.7.0
