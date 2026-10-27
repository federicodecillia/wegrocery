# Admin settings by topic (2026-10-27)

Presentation only: no migration, no change to how money moves.

## Problem
Admin → Impostazioni was one long page with every card open: identity, contacts, five payment cards, families, member names, the guide text, search misses and the configuration status. Stripe's state was shown in four places and the card settings were split across three cards.

## Change
- Four views on the bar Catalogo already uses (`/admin?tab=impostazioni&view=…`): **Pagamenti** (default), **Gruppo** (name, logo and colours; contacts and links), **Soci e guida** (member names, families, "Il nostro gruppo", search misses), **Tecniche** (configuration status, guided setup).
- Every block is a `SettingsPanel` (`<details>`): a title and one line with what is set now (`lib/admin/settings-summary.ts`). Only "How new cycles are paid" and the two small member settings start open; a panel opens by itself when something needs fixing (Stripe unreadable or unusable, a required variable missing) or when the URL's anchor points inside it. The open state survives a save.
- Card (Stripe): the connection, online top-up and wallet balance in card payments in one panel; the duplicate "Stripe unavailable" note and test badge under online top-up are gone.
- Proposed costs for new cycles: each cost is a select with the amount (unit inside the field) on one row, the same shape for wallet and card cycles. Card cycles still have no "None" fee (database constraint, migration 0021).
- The first-run setup (`/admin/avvio`) keeps the open cards.
