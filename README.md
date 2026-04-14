# Porta Moneta GAS - MVP Apps Script

Minimal MVP for the GAS workflow with only two roles:

- `member`
- `admin`

Tech stack:

- Google Apps Script (backend + web app)
- Google Sheets as datastore

## Project structure

- `src/` Apps Script source files
- `docs/blueprint-esecutivo.md` approved functional blueprint
- `docs/deploy-checklist.md` deployment and Workspace checklist

## Core capabilities

- Google login and role-based access
- One open cycle at a time
- Member order entry for open cycle
- Admin cycle management
- Admin topup registration
- Auto order charge on cycle close
- Member balance and history views

## Local setup with clasp

Prerequisites:

- Node.js
- `npm i -g @google/clasp`
- Access to the target Google Workspace account

Commands:

```bash
clasp login
clasp create --type webapp --title "Porta Moneta GAS"
clasp push
clasp open
```

Then in Apps Script editor:

1. Run `setupDataStore()` once.
2. Run `seedSampleData()` once.
3. Add real members with `adminUpsertMember(...)` or UI.
4. Deploy web app.

## Required script property

- `DATA_SPREADSHEET_ID`

This is set automatically by `setupDataStore()`.

## Validation checks

Run in Apps Script:

- `runSmokeTests()`

Expected output:

- `{ ok: true, ... }`

## Security model

- Only emails present in `members` with `active=TRUE` can access
- `member` can only access own data
- `admin` can access all admin endpoints
- UI does not enforce security, backend does

## Notes

- This MVP intentionally prefers simplicity over advanced workflows.
- It is optimized for fast rollout and low maintenance.
