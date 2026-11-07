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

### C. Public page
The next cycle and how to join, without signing in.

### D. Member import from CSV
Name and email only.

### B. Availability
A maximum quantity per product and cycle; members see only "Esaurito" when it runs out.
