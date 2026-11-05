# Order calendar (2026-11-04)

Requested by the Porta Moneta organizers: members should see which orders are coming, even before a cycle is complete, and the past ones too, laid out like a calendar.

## Problem
A cycle is created already open (`order_open_at` = now): until an admin opens it, members have no way to know what is coming. Past cycles are only in Storico, and only those the member ordered on.

## Plan, in three PRs

### A. `/calendario` (no migration)
- A month grid, Monday first, with a mark per kind of event on each day: orders open (round), orders close (square), pickup (diamond); colour and shape, so the meaning never rests on colour alone. Today is highlighted; tapping a day narrows the list to it.
- Under the grid (beside it from `lg`) the cycles with an event in the month, by their first event there. Each card: state (orders open, orders closed, finished), "you ordered" / "collected", supplier and product count, every event of the cycle with day and time, and a link to the order (open) or to Storico (ordered).
- Data: open and closed cycles of the last 365 days the member can see (`canAccessCycle`, or any cycle their family account ordered on); cancelled cycles stay in Storico. Days are worked out on the server in the group's time zone (`lib/calendar.ts`, unit tested). The months reach from the first event to the last, plus two months ahead of today.
- Entry points: a link card on Home and a link in Ordine when nothing is open. No new bottom-bar item (admins already have five). A member guide card ("ordinare" topic).

### B. Planned cycles (migration)
- A new cycle status `planned`, before `open`. Products go on it exactly as on an open cycle (by hand, from the catalogue or with the supplier sheet), so nothing is duplicated; members see it in the calendar with its dates and a preview of the products, marked as indicative, and cannot order.
- The dates are precise; a flag says they are indicative and the calendar shows it.
- Admin and "Referente ordini" create a cycle as planned, and "Apri gli ordini" turns it open (sets `order_open_at`, sends the usual notifications).
- Every check on the cycle status was reviewed: `= 'open'` checks (order saves, drafts, closing) keep refusing a planned cycle; checks that read "not open" as "closed" (history, payment mode change, Stripe connection) are updated.

### C. Notify me and calendar export
- "Avvisami quando apre" on a planned cycle: a notification when it opens.
- "Aggiungi al calendario": an `.ics` file with the pickup day.
