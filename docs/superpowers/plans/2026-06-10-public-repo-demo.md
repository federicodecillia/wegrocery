# Public Repo + Live Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the public porta_moneta repo into an effective showcase: MIT license, a clickable live demo (`DEMO_MODE`) with fake data and nightly reset, and a consulting CTA in the README.

**Architecture:** A second Vercel project (same repo) with `DEMO_MODE=true` and a separate Neon database. When the flag is on, Auth.js registers an extra Credentials provider ("demo-login") with two one-click roles; external side effects (Resend email) are guarded off. A seed script fills the demo DB with plausible fake data; a nightly GitHub Action re-runs it.

**Tech Stack:** Next.js 15 App Router, Auth.js v5, Drizzle ORM + Neon HTTP driver, tsx (new devDep, seed runner), GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-06-10-public-repo-demo-design.md`

**Repo facts the executor must know:**
- App root is `app_gas/` (Vercel project root too). All `npm` commands run from `app_gas/`.
- There is NO test runner in this repo (no jest/vitest). Verification = `npm run build` (includes type check), `npm run lint`, and exact manual checks listed per task. Do not introduce a test framework.
- `auth.ts` already contains a `dev-login` Credentials provider gated on `NODE_ENV !== "production"`. The new `demo-login` provider follows the same pattern but is gated on `DEMO_MODE === "true"` (demo runs as a production build on Vercel, so the dev gate would never fire there).
- Ledger sign convention: charges are negative strings (`(-total).toFixed(2)`), top-ups positive. Balance = SUM(amount). See `lib/actions/admin.ts:259` and `lib/db/queries.ts:24`.
- Member roles: `"admin" | "attivo" | "socio"`. Cycle `accessLevel: "soci"` admits roles socio/attivo/admin (see `canAccessCycle` in `lib/utils.ts:50`).
- ID convention: `<prefix>_<16 hex chars>` (see `lib/actions/admin-products.ts:23`).
- Drizzle `numeric` columns take **strings** (`"10.50"`), timestamps take `Date` objects.

**Branch:** create `feat/demo-mode` from the existing `docs/public-repo-demo-spec` branch, so spec + plan + code ship in one PR.

```bash
cd /Users/decilliaf/ai_projects/porta_moneta
git checkout docs/public-repo-demo-spec
git checkout -b feat/demo-mode
```

---

### Task 1: MIT LICENSE + README license section

**Files:**
- Create: `LICENSE` (repo root)
- Modify: `README.md` (the `## License` section at the bottom)

- [ ] **Step 1: Create LICENSE**

```text
MIT License

Copyright (c) 2026 Federico De Cillia

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 2: Replace the README `## License` section**

Replace the existing `## License` section (currently "published primarily as a portfolio piece … open an issue and let's talk") with:

```markdown
## License

Code is [MIT licensed](./LICENSE) — fork it, adapt it, run it for your own
GAS or co-op. The brand assets (`logo.png`, `icon.png`, the `portamoneta.org`
domain and the "Porta Moneta" name) belong to APS Porta Moneta and are **not**
covered by the license: replace them in your fork.
```

- [ ] **Step 3: Commit**

```bash
git add LICENSE README.md
git commit -m "docs: MIT license, brand assets excluded"
```

---

### Task 2: `demo-login` Credentials provider

**Files:**
- Modify: `app_gas/auth.ts`
- Modify: `app_gas/.env.example`

- [ ] **Step 1: Add the demo gate and provider to `auth.ts`**

Below the existing `devLoginEnabled` const (line ~10), add:

```ts
const demoModeEnabled = process.env.DEMO_MODE === "true";
const DEMO_LOGIN_EMAILS: Record<string, string> = {
  socio: "demo.socio@example.com",
  admin: "demo.admin@example.com",
};
```

Inside the `providers: [...]` array, after the `dev-login` spread block, add:

```ts
    ...(demoModeEnabled
      ? [
          Credentials({
            id: "demo-login",
            name: "Demo Login",
            credentials: { profile: {} },
            async authorize(credentials) {
              const profile = credentials?.profile === "admin" ? "admin" : "socio";
              const email = DEMO_LOGIN_EMAILS[profile];
              const db = getDb();
              const [member] = await db
                .select({
                  memberId: members.memberId,
                  fullName: members.fullName,
                  email: members.email,
                  active: members.active,
                })
                .from(members)
                .where(eq(members.email, email))
                .limit(1);

              if (!member?.active) return null;
              return {
                id: member.memberId,
                name: member.fullName,
                email: member.email,
              };
            },
          }),
        ]
      : []),
```

No other changes: the existing `signIn`/`jwt` callbacks already whitelist via the `members` table, and the demo users will exist there (Task 5).

- [ ] **Step 2: Document the flag in `.env.example`**

Append:

```text
# Demo deployment only — NEVER set on the production project.
# Enables one-click "Socio"/"Admin" logins and disables outbound email.
DEMO_MODE="false"
```

- [ ] **Step 3: Document the flag in `app_gas/SETUP.md`**

Append at the end of `app_gas/SETUP.md`:

```markdown
## Demo mode

`DEMO_MODE=true` enables one-click "Socio"/"Admin" demo logins and disables
outbound email. It is meant ONLY for the public demo deployment (separate
Vercel project + separate Neon database). Never set it on the production
project. Seed/reset demo data with `npm run db:seed:demo` (reads
`.env.demo.local`).
```

- [ ] **Step 4: Verify build**

```bash
cd app_gas && npm run build
```
Expected: build succeeds, no type errors.

- [ ] **Step 5: Commit**

```bash
git add app_gas/auth.ts app_gas/.env.example app_gas/SETUP.md
git commit -m "feat(demo): demo-login credentials provider behind DEMO_MODE"
```

---

### Task 3: Demo UI — login buttons + persistent banner

**Files:**
- Create: `app_gas/components/demo-banner.tsx`
- Modify: `app_gas/app/login/page.tsx`
- Modify: `app_gas/components/app-shell.tsx`

- [ ] **Step 1: Create `components/demo-banner.tsx`**

```tsx
export function DemoBanner() {
  if (process.env.DEMO_MODE !== "true") return null;
  return (
    <div className="border-b border-amber-300 bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
      🧪 Ambiente demo: dati fittizi, reset automatico ogni notte.
    </div>
  );
}
```

- [ ] **Step 2: Add demo buttons to `app/login/page.tsx`**

After the `hasDevLogin` const, add:

```tsx
  const isDemo = process.env.DEMO_MODE === "true";
```

Inside the `<div className="mt-6 space-y-3">` block, after the dev-login form, add:

```tsx
          {isDemo ? (
            <>
              <form
                action={async () => {
                  "use server";
                  await signIn("demo-login", { profile: "socio", redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="teal" block>
                  Entra come Socio (demo)
                </Button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await signIn("demo-login", { profile: "admin", redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="orange" block>
                  Entra come Admin (demo)
                </Button>
              </form>
            </>
          ) : null}
```

Also update the empty-state condition so the "Aggiungi le variabili auth…" hint doesn't show in demo: change `{!hasGoogleAuth && !hasDevLogin ? (` to `{!hasGoogleAuth && !hasDevLogin && !isDemo ? (`.

Add the banner: import `DemoBanner` and render it as the first child of `<main>`:

```tsx
import { DemoBanner } from "@/components/demo-banner";
```

```tsx
    <main className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col items-center justify-center p-6">
      <DemoBanner />
```

- [ ] **Step 3: Add the banner to `components/app-shell.tsx`**

Import `DemoBanner` and render it as the first child of the inner card div (just above `<header>`):

```tsx
import { DemoBanner } from "@/components/demo-banner";
```

```tsx
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] md:max-w-[640px] flex-col bg-pm-warm-white sm:min-h-[calc(100vh-3rem)] sm:rounded-xl sm:border sm:border-pm-border sm:shadow-sm">
        <DemoBanner />
        <header className="border-b border-pm-border px-5 py-4">
```

- [ ] **Step 4: Verify locally with the flag on**

```bash
cd app_gas && DEMO_MODE=true npm run dev
```
Open http://localhost:3000/login → expect the two demo buttons and the amber banner. (Login itself will fail until the demo members exist — that's Task 5/6.) Stop the server. Then check the flag-off path: `npm run dev` → no banner, no demo buttons.

- [ ] **Step 5: Commit**

```bash
git add app_gas/components/demo-banner.tsx app_gas/app/login/page.tsx app_gas/components/app-shell.tsx
git commit -m "feat(demo): demo login buttons and persistent demo banner"
```

---

### Task 4: Disable outbound email in demo

**Files:**
- Modify: `app_gas/lib/email/resend.ts`

- [ ] **Step 1: Add the guard at the top of `sendMail`**

First lines of the `sendMail` function body, before reading `RESEND_API_KEY`:

```ts
  if (process.env.DEMO_MODE === "true") {
    return { error: "Ambiente demo: invio email disabilitato" };
  }
```

`sendMail` already returns a discriminated result instead of throwing, so every caller already renders this as a normal error toast. (The Google Drive backup is a repo-level GitHub Action pointed at the prod DB secret — nothing to disable there. The demo Vercel project simply won't have `RESEND_API_KEY` set either, so this guard is defense in depth.)

- [ ] **Step 2: Verify build**

```bash
cd app_gas && npm run build
```
Expected: success.

- [ ] **Step 3: Commit**

```bash
git add app_gas/lib/email/resend.ts
git commit -m "feat(demo): block outbound email when DEMO_MODE is on"
```

---

### Task 5: Demo seed script

**Files:**
- Create: `app_gas/scripts/seed-demo.ts`
- Modify: `app_gas/package.json` (devDep `tsx` + script `db:seed:demo`)

- [ ] **Step 1: Install tsx**

```bash
cd app_gas && npm install --save-dev tsx
```

- [ ] **Step 2: Add the npm script**

In `app_gas/package.json` scripts (mirrors the existing `db:push` pattern of loading `.env*` via node):

```json
"db:seed:demo": "node --env-file=.env.demo.local node_modules/tsx/dist/cli.mjs scripts/seed-demo.ts"
```

- [ ] **Step 3: Create `scripts/seed-demo.ts`**

```ts
// Seeds the DEMO database with plausible fake data. Idempotent: truncates
// everything first. Refuses to run unless DEMO_MODE=true so it can never be
// pointed at production by accident (prod never sets that variable).
//
// Local:  npm run db:seed:demo   (reads .env.demo.local)
// CI:     DATABASE_URL=$DEMO_DATABASE_URL DEMO_MODE=true npx tsx scripts/seed-demo.ts
import crypto from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import {
  ledgerEntries,
  members,
  notifications,
  orderCycles,
  orders,
  products,
  suppliers,
  supplierProducts,
} from "../lib/db/schema";

if (process.env.DEMO_MODE !== "true") {
  console.error("Refusing to run: DEMO_MODE is not 'true'. This script WIPES the target database.");
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle({ client: sql });

const id = (prefix: string) => `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
const daysFromNow = (d: number, hour = 12) => {
  const date = new Date(Date.now() + d * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date;
};

async function main() {
  console.log("Truncating demo tables…");
  await sql`TRUNCATE TABLE orders, ledger_entries, products, supplier_products,
    order_cycles, suppliers, notifications, audit_log, members CASCADE`;

  // ── Members ────────────────────────────────────────────────────────
  const now = new Date();
  const mk = (fullName: string, email: string, role: string) => ({
    memberId: id("mem"),
    fullName,
    email,
    aliasEmail: null,
    role,
    active: true,
    createdAt: daysFromNow(-90),
    updatedAt: now,
  });
  const demoAdmin = mk("Alice Demo (Admin)", "demo.admin@example.com", "admin");
  const demoSocio = mk("Sofia Demo (Socio)", "demo.socio@example.com", "socio");
  const others = [
    mk("Marco Rossi", "marco.rossi@example.com", "attivo"),
    mk("Giulia Bianchi", "giulia.bianchi@example.com", "socio"),
    mk("Luca Ferrari", "luca.ferrari@example.com", "attivo"),
    mk("Elena Conti", "elena.conti@example.com", "socio"),
    mk("Paolo Greco", "paolo.greco@example.com", "socio"),
    mk("Chiara Moretti", "chiara.moretti@example.com", "attivo"),
  ];
  const allMembers = [demoAdmin, demoSocio, ...others];
  await db.insert(members).values(allMembers);
  console.log(`Inserted ${allMembers.length} members`);

  // ── Suppliers + catalog ────────────────────────────────────────────
  const mkSupplier = (name: string, macroCategory: string, email: string) => ({
    supplierId: id("sup"),
    name,
    macroCategory,
    contactName: null,
    phone: null,
    email,
    address: null,
    notes: null,
    active: true,
    createdAt: daysFromNow(-90),
  });
  const ortofrutta = mkSupplier("Azienda Agricola La Collina", "Ortofrutta", "ordini@lacollina.example.com");
  const forno = mkSupplier("Forno del Borgo", "Panificati", "forno@borgo.example.com");
  const apicoltura = mkSupplier("Apicoltura Miele Vivo", "Dispensa", "info@mielevivo.example.com");
  await db.insert(suppliers).values([ortofrutta, forno, apicoltura]);

  type CatalogItem = {
    supplierId: string; supplierName: string; name: string; format: string | null;
    unit: string | null; unitPrice: string; category: string; emoji: string;
  };
  const catalog: CatalogItem[] = [
    { supplierId: ortofrutta.supplierId, supplierName: ortofrutta.name, name: "Pomodori ciliegino", format: "cassetta 1 kg", unit: "kg", unitPrice: "3.50", category: "Verdura", emoji: "🍅" },
    { supplierId: ortofrutta.supplierId, supplierName: ortofrutta.name, name: "Zucchine", format: "1 kg", unit: "kg", unitPrice: "2.80", category: "Verdura", emoji: "🥒" },
    { supplierId: ortofrutta.supplierId, supplierName: ortofrutta.name, name: "Insalata gentile", format: "cespo", unit: "pz", unitPrice: "1.50", category: "Verdura", emoji: "🥬" },
    { supplierId: ortofrutta.supplierId, supplierName: ortofrutta.name, name: "Pesche", format: "2 kg", unit: "kg", unitPrice: "5.40", category: "Frutta", emoji: "🍑" },
    { supplierId: ortofrutta.supplierId, supplierName: ortofrutta.name, name: "Limoni non trattati", format: "1 kg", unit: "kg", unitPrice: "3.20", category: "Frutta", emoji: "🍋" },
    { supplierId: forno.supplierId, supplierName: forno.name, name: "Pane casereccio", format: "pagnotta 1 kg", unit: "pz", unitPrice: "4.50", category: "Panificati", emoji: "🍞" },
    { supplierId: forno.supplierId, supplierName: forno.name, name: "Focaccia alle olive", format: "teglia", unit: "pz", unitPrice: "6.00", category: "Panificati", emoji: "🫓" },
    { supplierId: apicoltura.supplierId, supplierName: apicoltura.name, name: "Miele millefiori", format: "vasetto 500 g", unit: "pz", unitPrice: "8.50", category: "Dispensa", emoji: "🍯" },
    { supplierId: apicoltura.supplierId, supplierName: apicoltura.name, name: "Miele di acacia", format: "vasetto 500 g", unit: "pz", unitPrice: "10.00", category: "Dispensa", emoji: "🍯" },
  ];
  await db.insert(supplierProducts).values(
    catalog.map((c) => ({
      catalogProductId: id("cat"),
      supplierId: c.supplierId,
      name: c.name,
      variant: null,
      format: c.format,
      unit: c.unit,
      unitPrice: c.unitPrice,
      pricePerKg: null,
      notes: null,
      category: c.category,
      emoji: c.emoji,
      active: true,
      createdAt: daysFromNow(-90),
      archivedAt: null,
    })),
  );
  console.log(`Inserted 3 suppliers, ${catalog.length} catalog products`);

  // ── Cycles ─────────────────────────────────────────────────────────
  const mkCycle = (title: string, openDay: number, closeDay: number, status: "open" | "closed") => ({
    cycleId: id("cyc"),
    title,
    pickupDate: daysFromNow(closeDay + 2, 17),
    pickupEndTime: "19:00",
    pickup2Date: null,
    pickup2EndTime: null,
    shippingCostPerMember: "1.50",
    shippingMode: "fixed_per_member",
    shippingTotal: null,
    orderOpenAt: daysFromNow(openDay, 9),
    orderCloseAt: daysFromNow(closeDay, 22),
    status,
    accessLevel: "soci",
    notes: null,
    createdBy: demoAdmin.email,
    createdAt: daysFromNow(openDay, 9),
    closedAt: status === "closed" ? daysFromNow(closeDay, 22) : null,
    supplierId: null,
  });
  const cycleOld = mkCycle("Ortofrutta e forno — ciclo 1", -16, -14, "closed");
  const cyclePrev = mkCycle("Ortofrutta e miele — ciclo 2", -9, -7, "closed");
  const cycleOpen = mkCycle("Ortofrutta e forno — questa settimana", -1, 5, "open");
  await db.insert(orderCycles).values([cycleOld, cyclePrev, cycleOpen]);

  // Per-cycle products copied from the catalog (first 7 items per cycle).
  const cycleProducts = new Map<string, { productId: string; unitPrice: string }[]>();
  for (const cycle of [cycleOld, cyclePrev, cycleOpen]) {
    const rows = catalog.slice(0, 7).map((c, i) => ({
      productId: id("prd"),
      cycleId: cycle.cycleId,
      name: c.name,
      variant: null,
      format: c.format,
      unitPrice: c.unitPrice,
      pricePerKg: null,
      unit: c.unit,
      supplier: c.supplierName,
      notes: null,
      sortOrder: i,
      active: true,
      supplierId: c.supplierId,
      category: c.category,
      emoji: c.emoji,
    }));
    await db.insert(products).values(rows);
    cycleProducts.set(cycle.cycleId, rows.map((r) => ({ productId: r.productId, unitPrice: r.unitPrice })));
  }
  console.log("Inserted 3 cycles with products");

  // ── Orders ─────────────────────────────────────────────────────────
  // whoOrders[i] orders (i+1) product lines with quantity (i % 2) + 1.
  const orderRows: (typeof orders.$inferInsert)[] = [];
  const charges = new Map<string, Map<string, number>>(); // cycleId -> memberId -> total
  const addOrders = (cycleId: string, when: Date, whoOrders: (typeof allMembers)[number][]) => {
    const prods = cycleProducts.get(cycleId)!;
    const byMember = new Map<string, number>();
    whoOrders.forEach((member, i) => {
      let total = 0;
      for (let line = 0; line <= i % 3; line += 1) {
        const product = prods[(i + line * 2) % prods.length];
        const quantity = (i % 2) + 1;
        const lineTotal = quantity * parseFloat(product.unitPrice);
        total += lineTotal;
        orderRows.push({
          orderLineId: id("ord"),
          cycleId,
          memberId: member.memberId,
          productId: product.productId,
          quantity,
          unitPriceSnapshot: product.unitPrice,
          lineTotal: lineTotal.toFixed(2),
          actualQuantity: null,
          actualLineTotal: null,
          updatedAt: when,
        });
      }
      byMember.set(member.memberId, total);
    });
    charges.set(cycleId, byMember);
  };
  addOrders(cycleOld.cycleId, daysFromNow(-15), [demoSocio, ...others.slice(0, 4)]);
  addOrders(cyclePrev.cycleId, daysFromNow(-8), [demoSocio, ...others.slice(1, 5)]);
  addOrders(cycleOpen.cycleId, daysFromNow(0, 10), [demoSocio, others[0], others[3]]);
  await db.insert(orders).values(orderRows);
  console.log(`Inserted ${orderRows.length} order lines`);

  // ── Ledger ─────────────────────────────────────────────────────────
  // Everyone gets an opening top-up; closed cycles charge order + shipping.
  const ledgerRows: (typeof ledgerEntries.$inferInsert)[] = [];
  for (const member of allMembers) {
    ledgerRows.push({
      entryId: id("led"),
      memberId: member.memberId,
      entryDate: daysFromNow(-30),
      type: "topup",
      amount: "100.00",
      cycleId: null,
      note: "Ricarica iniziale",
      createdBy: demoAdmin.email,
      createdAt: daysFromNow(-30),
      updatedAt: null,
      updatedBy: null,
    });
  }
  for (const cycle of [cycleOld, cyclePrev]) {
    const byMember = charges.get(cycle.cycleId)!;
    for (const [memberId, total] of byMember) {
      if (total <= 0) continue;
      ledgerRows.push({
        entryId: id("led"),
        memberId,
        entryDate: cycle.closedAt!,
        type: "order_charge",
        amount: (-total).toFixed(2),
        cycleId: cycle.cycleId,
        note: "Addebito ordine",
        createdBy: demoAdmin.email,
        createdAt: cycle.closedAt!,
        updatedAt: null,
        updatedBy: null,
      });
      ledgerRows.push({
        entryId: id("led"),
        memberId,
        entryDate: cycle.closedAt!,
        type: "shipping_charge",
        amount: "-1.50",
        cycleId: cycle.cycleId,
        note: "Spedizione",
        createdBy: demoAdmin.email,
        createdAt: cycle.closedAt!,
        updatedAt: null,
        updatedBy: null,
      });
    }
  }
  await db.insert(ledgerEntries).values(ledgerRows);
  console.log(`Inserted ${ledgerRows.length} ledger entries`);

  // ── Notifications ──────────────────────────────────────────────────
  await db.insert(notifications).values([
    {
      notificationId: id("not"),
      memberId: demoSocio.memberId,
      role: null,
      type: "topup_received",
      title: "Ricarica registrata",
      body: "La tua ricarica di 100,00 euro e' stata registrata.",
      href: "/storico",
      readAt: daysFromNow(-29),
      createdAt: daysFromNow(-30),
    },
    {
      notificationId: id("not"),
      memberId: demoSocio.memberId,
      role: null,
      type: "order_closed",
      title: "Ordine chiuso",
      body: `E' stato chiuso "${cyclePrev.title}". Controlla lo storico per il dettaglio.`,
      href: `/storico?cycleId=${cyclePrev.cycleId}`,
      readAt: null,
      createdAt: cyclePrev.closedAt!,
    },
  ]);

  console.log("Demo seed completed ✔");
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
```

- [ ] **Step 4: Verify type check passes**

```bash
cd app_gas && npm run build
```
Expected: success (the script is type-checked by the build's tsc pass; `@types/node` is already a devDep).

- [ ] **Step 5: Commit**

```bash
git add app_gas/scripts/seed-demo.ts app_gas/package.json app_gas/package-lock.json
git commit -m "feat(demo): idempotent demo seed script (npm run db:seed:demo)"
```

---

### Task 6: Neon demo database + run the seed (MANUAL infra + verification)

This task needs Federico (or the executor with his credentials) in the Neon dashboard.

- [ ] **Step 1: Create a separate Neon project**

In https://console.neon.tech → "New Project" → name `porta-moneta-demo`, region same as prod (check prod project's region), Postgres 17. Copy the pooled connection string. It must be a NEW project, not a branch of prod (spec: a connection-string mixup must never be able to touch prod).

- [ ] **Step 2: Create `app_gas/.env.demo.local`** (gitignored — verify with `git check-ignore app_gas/.env.demo.local`; `.gitignore` covers `.env*.local`)

```text
DATABASE_URL="<pooled connection string of porta-moneta-demo>"
DEMO_MODE="true"
```

- [ ] **Step 3: Push the schema to the demo DB**

```bash
cd app_gas && node --env-file=.env.demo.local node_modules/drizzle-kit/bin.cjs push
```
Expected: tables created on the demo Neon project.

- [ ] **Step 4: Run the seed TWICE (idempotence check)**

```bash
npm run db:seed:demo && npm run db:seed:demo
```
Expected: both runs end with `Demo seed completed ✔`, no unique-constraint errors.

- [ ] **Step 5: Run the app locally against the demo DB and verify end to end**

```bash
cd app_gas && DEMO_MODE=true DATABASE_URL="$(grep '^DATABASE_URL' .env.demo.local | cut -d'"' -f2)" npm run dev
```
Manual checks at http://localhost:3000:
1. `/login` shows the two demo buttons → "Entra come Socio (demo)" lands on home with a positive balance and the amber banner.
2. `/ordine` shows the open cycle; add a product → toast OK.
3. Logout → "Entra come Admin (demo)" → `/admin` opens; the analytics tab shows data; "Soci" tab shows ~8 members with balances.
4. From admin, try the supplier-email dialog (Distinta tab) → expect the error "Ambiente demo: invio email disabilitato".

- [ ] **Step 6: Guard check (negative test)**

```bash
cd app_gas && DEMO_MODE=false node node_modules/tsx/dist/cli.mjs scripts/seed-demo.ts; echo "exit: $?"
```
Expected: `Refusing to run…` message, `exit: 1`.

No commit (env file is local only).

---

### Task 7: Nightly demo reset workflow

**Files:**
- Create: `.github/workflows/demo-reset.yml` (repo root, next to `backup.yml`)

- [ ] **Step 1: Add the GitHub repo secret**

```bash
gh secret set DEMO_DATABASE_URL --repo federicodecillia/porta_moneta
```
Paste the demo Neon pooled connection string when prompted.

- [ ] **Step 2: Create `.github/workflows/demo-reset.yml`**

```yaml
name: Nightly Demo Reset

# Re-seeds the DEMO Neon database every night so the public demo at
# porta-moneta-demo.vercel.app always looks fresh (the open cycle's dates
# are relative to "now"). Also runnable on demand from the Actions tab.
#
# Required GitHub repository secret:
#   - DEMO_DATABASE_URL  Neon DEMO connection string (NOT production)

on:
  schedule:
    - cron: '0 2 * * *'
  workflow_dispatch:

jobs:
  reset:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: app_gas/package-lock.json

      - name: Install dependencies
        working-directory: app_gas
        run: npm ci

      - name: Seed demo database
        working-directory: app_gas
        env:
          DATABASE_URL: ${{ secrets.DEMO_DATABASE_URL }}
          DEMO_MODE: "true"
        run: npx tsx scripts/seed-demo.ts
```

- [ ] **Step 3: Commit and push the branch**

```bash
git add .github/workflows/demo-reset.yml
git commit -m "ci: nightly demo database reset workflow"
git push -u origin feat/demo-mode
```

- [ ] **Step 4: Test the workflow from the branch**

```bash
gh workflow run demo-reset.yml --ref feat/demo-mode && sleep 30 && gh run list --workflow=demo-reset.yml --limit 1
```
Expected: run completes with `success`. (If `gh workflow run` can't find it before merge, this check moves to right after the PR merge.)

---

### Task 8: Vercel demo project (MANUAL infra)

Needs the Vercel dashboard (or `vercel` CLI with Federico's account).

- [ ] **Step 1: Create the project**

Vercel dashboard → "Add New… → Project" → import `federicodecillia/porta_moneta` again → project name `porta-moneta-demo` → Root Directory: `app_gas` → Framework: Next.js.

- [ ] **Step 2: Set env vars (Production scope)**

| Name | Value |
|---|---|
| `DATABASE_URL` | demo Neon pooled connection string |
| `DEMO_MODE` | `true` |
| `AUTH_SECRET` | output of `openssl rand -hex 32` (new one, NOT prod's) |

Do NOT set `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `RESEND_API_KEY`, `MAIL_FROM`: their absence hides Google login and disables email natively.

- [ ] **Step 3: Deploy and verify**

Deploy the `feat/demo-mode` branch (Vercel builds it as a preview, or temporarily set the project's Production Branch to `feat/demo-mode`). Verify on the deployed URL the same 4 manual checks from Task 6 Step 5.

- [ ] **Step 4: Double-check prod isolation**

In the PROD Vercel project (`gas.portamoneta.org`): confirm `DEMO_MODE` is NOT in its env vars, then open https://gas.portamoneta.org/login → no demo buttons, no banner.

---

### Task 9: README marketing + repo metadata

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add the demo link at the top**

Change the live/changelog block to:

```markdown
**Live:** [gas.portamoneta.org](https://gas.portamoneta.org)
**Try it now:** [porta-moneta-demo.vercel.app](https://porta-moneta-demo.vercel.app) — one-click demo login (Socio or Admin), fake data, nightly reset
**Changelog:** [English](./app_gas/CHANGELOG.md) · [Italiano](./app_gas/CHANGELOG.it.md)
```

(Use the real demo URL from Task 8 if Vercel assigned a different one.)

- [ ] **Step 2: Add the consulting CTA section**

Append at the end of the README, after the License section:

```markdown
---

## Want this for your GAS / co-op / association?

Fork it and run it yourself — it's MIT. If you'd rather have someone set it
up, adapt it, or build something similar for your organization, that's what
I do: [gptchatbot.it](https://www.gptchatbot.it) ·
[LinkedIn](https://www.linkedin.com/in/federicodecillia) ·
[GitHub](https://github.com/federicodecillia)
```

> NOTE for executor: ask Federico to confirm the LinkedIn URL slug before committing this step (do not guess).

- [ ] **Step 3: Set repo description + topics**

```bash
gh repo edit federicodecillia/porta_moneta \
  --description "Production web app running a real Italian food co-op (GAS): order cycles, member ledger, admin analytics. Next.js 15 + Drizzle + Neon. Live demo inside." \
  --add-topic nextjs --add-topic react --add-topic typescript --add-topic drizzle-orm \
  --add-topic postgres --add-topic neon --add-topic vercel --add-topic gas \
  --add-topic food-coop --add-topic cooperative
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: live demo link, consulting CTA, repo metadata"
```

---

### Task 10: GIF + video walkthrough (MANUAL — Federico)

No code. Checklist for recording on the demo deployment:

- [ ] **Step 1: Record a 60–90s screen capture** (QuickTime / Screen Studio) on the demo URL, mobile-width window (~420px), scenes in order:
  1. Login page → "Entra come Socio (demo)" (3s)
  2. Home: balance hero + open cycle (5s)
  3. `/ordine`: add 2–3 products with the steppers (15s)
  4. `/storico`: ledger movements (5s)
  5. Logout → "Entra come Admin (demo)" (5s)
  6. Admin: cycles tab → products tab → analytics dashboard (25s)
- [ ] **Step 2: Export a short GIF** (10–20s, the order flow + analytics, ≤10 MB) to `docs/demo.gif` in the repo. Keep the full video local for the LinkedIn post (native upload).
- [ ] **Step 3: Embed the GIF in the README** right under the intro paragraph:

```markdown
![Porta Moneta GAS demo](./docs/demo.gif)
```

- [ ] **Step 4: Commit**

```bash
git add docs/demo.gif README.md
git commit -m "docs: demo walkthrough GIF"
```

- [ ] **Step 5 (optional, dashboard):** upload a social preview image (Settings → Social preview), e.g. a framed screenshot of the analytics tab.

---

### Task 11: PR + finalize

- [ ] **Step 1: Push and open the PR**

```bash
git push origin feat/demo-mode
gh pr create --title "Public repo polish: MIT license + live demo mode" --body "$(cat <<'EOF'
## Summary
- MIT LICENSE (brand assets excluded) + README license rewrite
- DEMO_MODE: one-click Socio/Admin demo login (Credentials provider), amber demo banner, outbound email blocked
- Idempotent demo seed script + nightly reset GitHub Action (separate Neon project, secret DEMO_DATABASE_URL)
- README: live demo link, walkthrough GIF, consulting CTA, repo topics

Spec: docs/superpowers/specs/2026-06-10-public-repo-demo-design.md
Plan: docs/superpowers/plans/2026-06-10-public-repo-demo.md

## Test plan
- [ ] `npm run build` + `npm run lint` green
- [ ] Demo deployment: socio + admin login, order flow, analytics, email blocked
- [ ] Prod (gas.portamoneta.org): NO demo buttons/banner after merge
- [ ] `demo-reset.yml` manual dispatch succeeds

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: After merge** — switch the demo Vercel project's Production Branch back to `main` (if changed in Task 8), trigger a demo redeploy, dispatch `demo-reset.yml` once from main, and re-verify the demo URL.

---

## Execution notes

- Tasks 1–5 are pure code and can run back-to-back. Task 6 and 8 need Neon/Vercel dashboard access (Federico). Task 10 is fully manual (recording).
- The LinkedIn post is OUT of this plan — it happens after merge, with the demo URL and video in hand.
- The seed script is type-checked by `next build`'s tsc pass (it imports only existing typed modules; `@types/node` is already installed). If an unexpected tsconfig issue appears, add `"scripts"` to the `exclude` array of `app_gas/tsconfig.json` — tsx runs it regardless of tsconfig.
