# Deploy Checklist (Google Workspace)

## 1. Permissions

Minimum required:

- Shared Drive access for project owner
- Permission to create Apps Script Web App
- Permission to create Google Sheets in Shared Drive

Optional but recommended:

- Google Group for admin users

## 2. Create Apps Script project

Using clasp:

```bash
clasp login
clasp create --type webapp --title "Porta Moneta GAS"
```

Copy local `src/*` files to project and push:

```bash
clasp push
```

## 3. Initialize datastore

From Apps Script editor execute:

1. `setupDataStore()`
2. `seedSampleData()`

Validation:

- Confirm `DATA_SPREADSHEET_ID` script property exists.
- Confirm sheets are created:
  - `members`
  - `order_cycles`
  - `products`
  - `orders`
  - `ledger_entries`
  - `audit_log`

## 4. Create first admin/member users

From UI or Apps Script function `adminUpsertMember`.

Validation checks:

- Duplicate email is updated, not duplicated.
- Roles only `member` or `admin`.

## 5. Deploy web app

Deploy config:

- Execute as: `User accessing the web app`
- Access: according to your domain policy

Post-deploy checks:

- Admin login works
- Member login works
- Unauthorized user is blocked

## 6. Functional smoke test

Admin path:

1. Create cycle
2. Add products
3. Add/update one member order
4. Close cycle
5. Register topup
6. Verify balance

Member path:

1. Access dashboard
2. Save order for open cycle
3. Verify only own ledger and history are visible

## 7. Data quality checks

- Target: `orders`, mode: `upsert` by `cycle_id + member_id + product_id`
- Target: `ledger_entries`, mode: `insert`
- Check: no duplicate `order_charge` for same `cycle_id + member_id`
- Check: balance equals sum of ledger entries by member

## 8. Go-live sequence

1. Add real users
2. Load initial balances as `adjustment` or `topup`
3. Open first real cycle
4. Pilot with small subset of members
5. Full rollout next cycle
