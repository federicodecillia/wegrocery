# Launch phase 1: groups beyond the first one (2026-11-07)

Requested by the maintainer to make WeGrocery ready for a cooperative that sells to customers without a membership card, besides closed buying groups. Every feature is off by default and set by the admin, so existing groups see no change.

## Plan, one PR each, in this order

### E. Terms and privacy acceptance (migration 0051)
- `brand.termsUrl` next to `brand.privacyUrl`, in the brand JSON and in Admin → Impostazioni → Identità.
- Admin → Impostazioni → "Termini e privacy": ask whoever signs in to accept them. Turning it on, or "ask again" after the documents change, sets `app_settings.terms_version` (an ISO timestamp); it needs at least one link.
- Until the person who signed in accepts the current version, AppShell shows an acceptance card instead of the page (links, "I have read and accept", sign out), and saving an order, paying an order and topping up are refused on the server (`terms_required`). Acceptance is stored per person (`members.terms_accepted_at`, `terms_accepted_version`) with an audit row.
- The app hosts no legal text: each group is the data controller and owns its documents.

### A. Open sign-up (migration 0052)
- Admin → Impostazioni → Soci e guida → "Chi può entrare": `closed` (default, as before), `request` or `open` (`app_settings.signup_mode`), the newcomers' role (`signup_role`, never admin) and "newcomers pay before ordering" (`signup_prepaid`, on by default).
- `request`: an address that is not a member gets an email pointing to `/aderisci` (public, outside the session redirect). The form (name, email, optional phone and note, the terms box when the group asks for them, a honeypot) stores a row in `membership_requests`; the answer is always the same, so the page never tells who is a member. One pending request per address (partial unique index), three per IP hash an hour. Admins get an in-app notification and decide in Admin → Soci; approving creates the member in one guarded statement (two clicks create one member) and sends the invitation link. Rejected requests are deleted after 30 days.
- `open`: a confirmed address (email link, or Google with a verified address) becomes a member at once.
- The card check, when on, still admits a valid card as before; the mode applies to addresses without one. A deactivated member stays out in every mode. Members who joined this way (`members.joined_via`) are never asked for a card.
- Prepaid: the credit check of `saveOrder` uses a limit of zero for these members (`effectiveMinBalance`), whatever the group's limit. A pay-per-order cycle is unchanged: the order is paid by card when confirmed.

### C. Public page (migration 0053)
- Admin → Impostazioni → Gruppo → "Pagina pubblica": on (`public_page_enabled`), products of the next cycle (`public_products_preview`), indexable (`public_page_indexable`, else `noindex`), and a text in the format of "Il nostro gruppo" (`public_intro`, 2000 characters). All off by default.
- `/gruppo`, outside the session redirect: logo, name, text, the next cycle open to every member (an open one closing soonest, else the planned one opening soonest; admin-only cycles never), optional products (name, variant, price), "Entra" and, by sign-up mode, "Chiedi di aderire" or "Registrati". Off: it redirects to `/login`.
- `/` without a session cookie redirects to `/gruppo` (the proxy still reads no database), so a group without the page gets one extra hop to `/login`.
- Every query of the page is in `lib/db/public.ts`, column by column; a unit test keeps member, order, payment and ledger tables out of it.

### D. Member import from CSV
- Admin → Soci → "Importa da file": a CSV file or pasted text, comma, semicolon or tab, UTF-8 or Windows-1252, at most 2000 rows and 500 KB (under the server action body limit). No migration.
- Columns are recognised by header in four languages: email (required), full name or first and last name, secondary email, role, pays outside the app. Other columns are listed as not used.
- `planImport` (pure, `lib/members/import.ts`) gives every row an outcome against the members of that moment: new, new with the same name as a member, already a member, repeated in the file, invalid email, no email, secondary email already used. Emails and aliases share one namespace, lower-cased. An admin role in the file becomes the base role: admins are named by hand.
- The preview and the import each plan the file again on the server. The insert is one statement with ON CONFLICT DO NOTHING, so importing twice, or a member created between preview and import, never doubles anyone. The audit keeps counts, never addresses.
- No email at import. "Invita i nuovi soci" sends the usual invitation link 20 at a time (the email provider's daily limit), skipping members already signed in or not admitted.

### B. Availability (migration 0054)
- Admin → Impostazioni → Gruppo → "Quantità limitate" (`app_settings.stock_limits_enabled`, off). On a cycle product: "Disponibili" (`products.max_quantity`) and "Massimo per socio" (`products.max_per_member`), empty = unlimited. Ciclo → Prodotti shows "12 su 30".
- Nothing is counted down: what is left is computed (`lib/products/stock.ts`) as the units minus what the other members hold, where a member holds the larger of their confirmed quantity and what an open card Checkout of theirs reserves (32 minutes, a little more than the Checkout's 31).
- `stockFitsSql` runs under the cycle's row lock, before the member's lines are replaced, in `saveOrder`, `confirmOrderWithoutPayment`, the pending payment of `startOrderPayment` (now written in a batch with the lock), the webhook's `creditBatch` and `replaceOpenOrder` (admin on an open cycle). A line that does not grow always passes, so trimming or keeping an order never fails. With the setting off it is always true.
- Refused: `sold_out` with the short lines; the form shows them with "Adatta alle disponibilità". The member never sees a number left (D3): only "Esaurito" when nothing is left, the + stays at the cap per member.
- A paid Checkout whose reservation expired and whose product went meanwhile follows the late-payment path: credit and full refund (`late_<paymentId>`).
- Admin cannot set the units below what is held (same lock). Closed-cycle edits ignore the limits.
- Nightly invariant `product_max_quantity` (open and planned cycles, setting on).
- Added after the staging trial: the listing import into a cycle maps "Disponibili" and "Massimo per socio" columns (`lib/csv/header-heuristics.ts`, cells read by `parseLimitCell`) and applies them through `setProductLimits`, matched by name, variant and format; a column left out keeps the product's value, units below what is sold are refused and counted. The catalogue-only import hides both fields. The public page marks sold out products with `readSoldOutProductIds` (ids only, never a count; `lib/db/public.ts` still reads no orders).

