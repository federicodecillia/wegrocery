# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Porta Moneta GAS** is a web app for managing a community food cooperative (GAS — Gruppo di Acquisto Solidale). It replaces a shared Google Sheet with a web application for weekly produce orders and member balance tracking.

The entire stack runs on Google's free tooling: Google Apps Script (backend + hosting), Google Sheets (datastore), Google Account login (auth), vanilla HTML/CSS/JS (frontend). There are no npm packages, no build step, and no external services.

## Project Structure

The actual deployable code lives in `app_gas/src/`. The root `src/` directory is an older version — do NOT edit it.

```
app_gas/
├── .clasp.json          # Clasp config (scriptId, rootDir: src)
└── src/                 # ← THIS is the active codebase
    ├── Main.gs          # API router — callApi() dispatcher
    ├── Config.gs        # Sheet names, column schemas, constants
    ├── Storage.gs       # Sheet CRUD + CacheService layer
    ├── Auth.gs          # Session resolution, requireSession_(), requireAdmin_()
    ├── Orders.gs        # Member dashboard, order saving
    ├── Cycles.gs        # Cycle create/close/list
    ├── Products.gs      # Product loading and duplication
    ├── Ledger.gs        # Balance tracking, topups, order charges
    ├── Members.gs       # Member CRUD (adminUpsertMember, adminGetMembers)
    ├── Audit.gs         # Append-only audit trail
    ├── Setup.gs         # First-run sheet creation and seed data
    ├── Migration.gs     # Data migration utilities
    ├── Utils.gs         # Helpers: assert_, generateId_, nowIso_, toNumber_
    ├── Test.gs          # Test & utility functions (runAllTests, runEndToEndTest, etc.)
    ├── Index.html       # HTML shell with includes
    ├── Styles.html      # All CSS (mobile-first, bottom nav)
    ├── AppCore.html      # PM namespace, API wrapper, router, toast, confirm dialog
    ├── AppMember.html    # Member-specific logic (Promise.finally polyfill)
    ├── AppAdmin.html     # Admin panel orchestrator (tab switching)
    ├── ComponentMemberHome.html    # Member dashboard (balance, cycle status)
    ├── ComponentOrderForm.html     # Order form with stepper UI
    ├── ComponentHistory.html       # Order history + ledger tabs
    ├── ComponentGuide.html         # User guide
    ├── ComponentAdminCycle.html    # Cycle management
    ├── ComponentAdminProducts.html # Product loading (text/duplicate)
    ├── ComponentAdminOrders.html   # Order summary (by product/member)
    ├── ComponentAdminLedger.html   # Topup recording + balance table
    ├── ComponentAdminMembers.html  # Member management
    └── appsscript.json             # Apps Script manifest
```

## Development Commands

All clasp commands must be run from `app_gas/` directory:

```bash
cd app_gas
clasp login                # Authenticate with Google
clasp push --force         # Push src/ to Apps Script
clasp deploy -i <ID> -d "description"  # Update deployment
clasp deployments          # List deployments
```

Current deployment ID: `AKfycbzaYomy3jUuu3GXVlRHR88TZKh1LK2BZkNzVKyCUm1KqV71I_vEIVNAgyozJbD2b4onhA`

Quick push + deploy:
```bash
cd app_gas && clasp push --force && clasp deploy -i AKfycbzaYomy3jUuu3GXVlRHR88TZKh1LK2BZkNzVKyCUm1KqV71I_vEIVNAgyozJbD2b4onhA -d "description"
```

**Note**: `clasp open` is NOT supported in this clasp version. Use direct URL:
```
https://script.google.com/home/projects/1Z_0LkvuRHTIb4FfpjWOtZiOL24Rr124COmEeiC2DG9KfqO2xxFd3rYBs/edit
```

**Test & utility functions** (run in Apps Script editor, select function then click Run):
```javascript
runAllTests()        // Basic sanity checks
runEndToEndTest()    // Full cycle: create → products → order → close → verify
createDemoCycle()    // Creates open cycle with 18 realistic products
addNewMembers()      // Adds preconfigured members
```

## Architecture

### Request Flow

```
Frontend (ComponentXxx.html) → PM.api(action, payload)
  → google.script.run.callApi(action, payload)
    → Main.gs::callApi() dispatcher
      → requireSession_() or requireAdmin_() auth check
      → Handler function
        → Storage.gs (CacheService → Google Sheets)
```

### Storage Layer

Storage.gs implements a **CacheService layer over Google Sheets**:
- First read → loads from Sheets (~1-2s), caches for 5 minutes
- Subsequent reads → served from CacheService (~50ms)
- Every write → invalidates the relevant cache key
- Data always persists in Sheets; cache is a transparent accelerator
- 100KB per key limit (well within our data size)

### Frontend Architecture

The frontend is a **single-page app with hash-based routing** using Design System v2:
- `PM` namespace in AppCore.html — API wrapper, router, toast, confirm
- Navigation: `#home`, `#ordine`, `#storico`, `#guida`, `#admin`
- Components load data on view change via `PM._onViewChange()`
- All components show error state with retry button on failure

### Design System v2 (current)

Full design spec in `docs/design.md`. Key features:
- **Palette**: Emerald scale (primary-50 to primary-700) with semantic colors
- **Nav bar**: SVG icons (outline/filled states), glass effect with backdrop-blur
- **Loading**: Skeleton shimmer animation (no spinner)
- **Saldo hero card**: Large balance with gradient background (green=positive, red=negative)
- **Cycle progress bar**: Visual countdown with urgency badge when < 12h remaining
- **Product stepper**: Bounce animation on quantity change, tinted card when qty > 0
- **History**: Animated chevron expand, smooth max-height transitions
- **Animations**: fade+slide between views, spring toast, scale modal, qty bump
- **Accessibility**: `prefers-reduced-motion` disables all animations
- **Empty states**: Emoji icon + message + CTA for every empty view

### Data Model (Google Sheets as tables)

Six sheets in one Spreadsheet — no formulas, all values computed server-side:

- **members** — User registry; `role` is `member` or `admin`
- **order_cycles** — Weekly order windows; only one `open` cycle at a time
- **products** — Per-cycle product list; loaded from text format or duplicated
- **orders** — Line items per member per cycle
- **ledger_entries** — Double-entry balance: `topup` (positive) and `order_charge` (negative)
- **audit_log** — Append-only admin action log

ID prefix convention: `cyc_*`, `mem_*`, `prd_*`, `ord_*`, `led_*`, `aud_*`.

### Security Model

- All auth enforcement is server-side only. Frontend role-switching is cosmetic.
- `requireSession_()` blocks unauthenticated calls; `requireAdmin_()` blocks non-admins.
- Members can only read their own data (filtered by `member_id`).
- Never trust anything from the frontend payload for access control decisions.

### Key Business Rules

- Closing a cycle auto-generates `order_charge` ledger entries for every member with orders.
- Member balance = `SUM(ledger_entries.amount)` for that member.
- Products are loaded via plain text: one line per product, fields separated by `;` (`Name;Variant;Format;Price;Supplier;Notes`).
- Email is the unique identifier for members (used as login key via Google Session).

### Known Issues / Lessons Learned

- **Date serialization**: Google Sheets returns Date objects from cells. These must be converted to ISO strings in `readSheetObjects_()` before returning via `google.script.run`, otherwise the client receives null/undefined causing "Errore sconosciuto".
- **Spreadsheet open caching**: `SpreadsheetApp.openById()` is expensive. The `_cachedSpreadsheet` variable avoids reopening on every read within the same execution.
- **`clasp push` vs deploy**: `clasp push` only updates source code. Must also run `clasp deploy -i <ID>` to update the live web app.
- **Error handling**: All components must show error state with retry button, not just toast (which disappears after 3s leaving spinner forever).

## Docs

- `docs/blueprint-esecutivo.md` — Comprehensive functional spec: UX wireframes, data model rationale, validation rules, acceptance criteria.
- `docs/deploy-checklist.md` — Deployment procedure and post-deploy validation steps.
- `docs/design.md` — Design System v2: palette, typography, spacing, all component specs, wireframes, implementation checklist.
