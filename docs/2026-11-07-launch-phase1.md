# Launch phase 1: groups beyond the first one (2026-11-07)

Requested by the maintainer to make WeGrocery ready for a cooperative that sells to customers without a membership card, besides closed buying groups. Every feature is off by default and set by the admin, so existing groups see no change.

## Plan, one PR each, in this order

### E. Terms and privacy acceptance (migration 0051)
- `brand.termsUrl` next to `brand.privacyUrl`, in the brand JSON and in Admin → Impostazioni → Identità.
- Admin → Impostazioni → "Termini e privacy": ask whoever signs in to accept them. Turning it on, or "ask again" after the documents change, sets `app_settings.terms_version` (an ISO timestamp); it needs at least one link.
- Until the person who signed in accepts the current version, AppShell shows an acceptance card instead of the page (links, "I have read and accept", sign out), and saving an order, paying an order and topping up are refused on the server (`terms_required`). Acceptance is stored per person (`members.terms_accepted_at`, `terms_accepted_version`) with an audit row.
- The app hosts no legal text: each group is the data controller and owns its documents.

### A. Open sign-up
Customers register themselves and the admin approves them; by default they pay order by order, not with a prepaid balance.

### C. Public page
The next cycle and how to join, without signing in.

### D. Member import from CSV
Name and email only.

### B. Availability
A maximum quantity per product and cycle; members see only "Esaurito" when it runs out.
