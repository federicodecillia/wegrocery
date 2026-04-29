# Progressi Migrazione v3

> Diario operativo. Aggiornare a fine di ogni sessione di lavoro.
> Formato: data | autore | cosa fatto | cosa resta / blockers.

---

## 2026-04-28 — Setup iniziale

**Autore**: Federico + Claude
**Tempo**: ~30 min
**Cosa fatto:**
- Commit baseline v2 su `main` (commit `c697f40`) — `app_gas_v2/`, `DESIGN.md`, `mintlify/`, `scripts/` ora tracciati in git
- Creato branch `migration/nextjs-v3` da main
- Creata cartella `app_gas_v3/`
- Scritto `PLAN.md` (piano operativo completo a 6 fasi)
- Scritto questo file `PROGRESS.md`

**Cosa resta (next session):**
- Fase 0 — Foundation:
  - [ ] Decidere account Vercel (personale vs nuova org)
  - [ ] Decidere account Neon
  - [ ] Decidere se nuovo progetto GCP per OAuth o riuso v2
  - [ ] Scaffold Next.js 15 con TS + Tailwind in `app_gas_v3/`
  - [ ] Creare progetto Vercel + Neon
  - [ ] Configurare Auth.js Google provider
  - [ ] Primo deploy + URL preview funzionante

**Blockers**: nessuno tecnico. Solo decisioni account/org da prendere prima di iniziare la Fase 0.

**Note:**
- v2 resta su `gas.portamoneta.org` invariata e attiva durante tutta la migrazione
- v3 vivrà su URL Vercel (`gas-v3.vercel.app` o equivalente) finché non si fa cutover
- Tempo stimato totale residuo: 10-13 giorni di lavoro effettivo

---

## 2026-04-28 — Fase 0 avviata (foundation locale)

**Autore**: Codex
**Tempo**: ~90 min
**Fase corrente**: Fase 0

**Cosa fatto:**
- Scaffold iniziale Next.js creato e portato in `app_gas_v3/` mantenendo `PLAN.md`, `PROGRESS.md`, `README.md`
- Setup dipendenze fase 0 completato:
  - `next@15`, `react@19`
  - `next-auth@5.0.0-beta.30`
  - `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`
- Configurati file foundation richiesti:
  - `auth.ts`
  - `middleware.ts`
  - `drizzle.config.ts`
  - `.env.example`
  - `app/api/auth/[...nextauth]/route.ts`
  - `/` protetta con redirect a `/login` e visualizzazione `session.user.email` dopo login
- Applicata palette base v2 (orange/teal) in `app/globals.css`
- Validazione locale completata:
  - `npm run lint` ✅
  - `npm run build` ✅

**Cosa resta (Fase 0):**
- [ ] Creare progetto Vercel e collegarlo a `app_gas_v3/` come root
- [ ] Creare progetto Neon e impostare `DATABASE_URL` reale
- [ ] Creare credenziali Google OAuth e impostare `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`
- [ ] Impostare env su Vercel (`DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- [ ] Primo deploy pubblico e verifica login end-to-end in incognito

**Blockers / decisioni aperte:**
- Scelta account/org per Vercel e Neon non definita
- Credenziali OAuth non disponibili nella workspace locale

**Note tecniche:**
- Build stabile su Next `15.5.15`
- `npm run dev` parte su `http://localhost:3000` (nel container appaiono warning `EMFILE` del file watcher, non bloccanti per build/deploy)

---

## Template per nuove entry

```
## YYYY-MM-DD — <titolo breve>

**Autore**:
**Tempo**:
**Fase corrente**:

**Cosa fatto:**
- ...

**Cosa resta:**
- ...

**Blockers / decisioni aperte:**
- ...

**Note tecniche:**
- ...
```

---

## 2026-04-28 — Fase 0 chiusa + Fase 1 (schema/migrazione) completata

**Autore**: Federico + Codex  
**Tempo**: ~3h  
**Fase corrente**: transizione a Fase 2

**Cosa fatto:**
- Progetto Vercel creato con root `app_gas_v3/`
- Auth Google configurata su Vercel (`AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`)
- Deploy v3 validato con login Google end-to-end
- Neon configurato e `DATABASE_URL` impostata su Vercel
- Schema Drizzle completato con 7 tabelle target:
  - `members`, `suppliers`, `order_cycles`, `products`, `orders`, `ledger_entries`, `audit_log`
- `db:push` eseguito con successo su Neon
- Endpoint v2 `exportAll` creato e deployato su Apps Script web app
- Script migrazione `scripts/migrate-from-v2.mjs` creato ed eseguito con successo
- Import dati completato su Neon con conteggi coerenti:
  - `members=30`, `suppliers=18`, `order_cycles=20`, `products=434`, `orders=569`, `ledger_entries=49`, `audit_log=57`

**Cosa resta (next):**
- [ ] Fase 2.1 — bloccare login ai soli membri presenti/attivi in `members`
- [ ] Fase 2.2 — middleware auth/admin routing
- [ ] Fase 2.3+ — shell app (header + bottom nav) e componenti base

**Note tecniche:**
- Script migrazione supporta input da file (`V2_EXPORT_FILE`) o URL (`V2_EXPORT_URL`)
- `catalog_products` esportata da v2 ma non ancora modellata/importata in v3

---

## 2026-04-28 — Fase 2.2 quick completata (routing auth/admin)

**Autore**: Federico + Codex  
**Tempo**: ~35 min  
**Fase corrente**: Fase 2

**Cosa fatto:**
- Middleware v3 attivata su tutte le route app (escluse route tecniche):
  - redirect a `/login` se non autenticato
  - redirect a `/` se autenticato e visita `/login`
  - accesso `/admin` consentito solo a `role=admin`
- Auth.js callbacks estesi:
  - `jwt` aggiunge `role` e `active` da tabella `members`
  - `session` espone `role` e `active` su `session.user`
- Creata pagina placeholder `/admin` protetta server-side

**Validazione locale:**
- `npm run lint` ✅
- `npm run build` ✅

**Cosa resta (next):**
- [ ] Deploy su Vercel di queste modifiche
- [ ] Smoke test cloud:
  - utente non autenticato -> redirect `/login`
  - utente member attivo -> `/` ok
  - utente non admin su `/admin` -> redirect `/`
  - utente admin su `/admin` -> accesso consentito
- [ ] Fase 2.3 shell layout (header + bottom nav)

---

## 2026-04-28 — Fase 2.3 quick completata (shell + bottom nav)

**Autore**: Federico + Codex  
**Tempo**: ~40 min  
**Fase corrente**: Fase 2

**Cosa fatto:**
- Creata shell app condivisa con:
  - header (branding PM, email utente, logout)
  - area contenuto scrollabile
  - bottom nav a 5 tab: `Home`, `Ordine`, `Storico`, `Guida`, `Admin`
- Aggiunte route placeholder per completare il routing base fase 2.3:
  - `/ordine`
  - `/storico`
  - `/guida`
- Rifattorizzata gestione sessione con helper:
  - `lib/auth/session.ts` (`requireUserSession`, `getUserRole`)
- Adeguato stile globale al frame v2 (sfondo esterno grigio + nav height)

**Cosa resta (next):**
- [ ] Merge branch `migration/nextjs-v3` -> `main` (se non ancora fatto)
- [ ] Deploy Vercel su `main` e smoke test cloud della shell
- [ ] Fase 2.4 palette/theming raffinata + 2.5 componenti base (`Button`, `Card`, `Toast`, `ConfirmDialog`)
- [ ] Fase 2.6 import logo asset PM

**Blockers / decisioni aperte:**
- In questa workspace non disponibili `gh`/GitHub connector con permessi repo: PR/merge da completare via GitHub UI

---

## 2026-04-28 — Fase 2.4 completata (palette Tailwind v2)

**Autore**: Federico + Codex  
**Tempo**: ~25 min  
**Fase corrente**: Fase 2

**Cosa fatto:**
- Palette v2 (`orange/teal/gray/red/frame/border`) mappata in token Tailwind via `@theme` in `app/globals.css`
- Esposti token semantici (`pm-*`) per colori e spacing nav (`h-nav-h`)
- Refactor classi UI principali (shell, bottom nav, login, placeholder pages) da `var(--...)` inline a classi Tailwind semantiche (`bg-pm-*`, `text-pm-*`, `border-pm-*`)
- Allineato `layout.tsx` al token testo principale

**Validazione locale:**
- `npm run lint` ✅
- `npm run build` ✅

**Cosa resta (next):**
- [ ] Fase 2.5 — componenti base riusabili (`Button`, `Card`, `Toast`, `ConfirmDialog`)
- [ ] Fase 2.6 — import logo PM come asset reale in `public/`

---

## 2026-04-28 — Fase 2.5 completata (UI primitives base)

**Autore**: Federico + Claude
**Tempo**: ~40 min
**Fase corrente**: Fase 2

**Cosa fatto:**
- Installate dipendenze UI: `clsx`, `tailwind-merge`, `sonner`, `@radix-ui/react-dialog`, `lucide-react`
- Aggiunto helper `cn()` in `lib/utils.ts`
- Creati componenti UI in `components/ui/`:
  - `button.tsx` — 6 varianti (`primary`/`orange`/`teal`/`red`/`ghost`/`outline`), 2 size (`sm`/`md`), prop `block`. Stile pill match v2 (`Styles.html:380-411`).
  - `card.tsx` — `<Card>`, `<CardHeader>`, `<CardBody>`, `<CardFooter>` con stile v2 (radius 18px, border, shadow soft).
  - `toast.tsx` — re-export `toast` da sonner.
  - `confirm-dialog.tsx` — API imperativa `confirm({title, message, danger?, ...}) → Promise<boolean>` su Radix Dialog (focus trap, Escape, ARIA gratis).
- Provider `components/providers/toaster.tsx` — `<Toaster>` di sonner top-center, 3s, classi pm-* per success/warning/error.
- `app/layout.tsx` monta `<Toaster />` e `<ConfirmDialogProvider />`.
- Refactor minimo per validare i componenti:
  - `app/login/page.tsx` → `<Button variant="teal" block>` al posto del `<button>` raw.
  - `components/app-shell.tsx` + nuovo `components/logout-button.tsx` (Client Component) → bottone ghost piccolo + `confirm()` prima di `signOut`.

**Decisioni:**
- Niente CVA (con 5 varianti un record `{variant: classes}` è più leggibile e ~3 KB più leggero).
- Niente `loading` prop sul Button: si aggiungerà in Fase 3.2 quando una pagina reale lo richiede.
- Niente `SaldoCard`/`CycleCard` dedicati: la `<Card>` base supporta override via `className`, le hero card verranno create in Fase 3.1.

**Validazione locale:**
- `npm run lint` ✅
- `npm run build` ✅ (10/10 routes generate, no warnings)

**Cosa resta (next):**
- [ ] Smoke test in `npm run dev`: login pill teal, logout con conferma modale (Esc/click fuori), `toast.warning("...")` da console.
- [ ] Commit `[v3] feat: phase 2.5 base UI components` + push su `migration/nextjs-v3`.
- [ ] Fase 2.6 — import logo PM come asset reale in `public/`.

**Note tecniche:**
- Le animazioni del Dialog usano classi `data-[state=open]:animate-in ...` che richiederebbero `tailwindcss-animate`; non installato, quindi il dialog appare/scompare senza fade/zoom — sufficiente per ora, polish in Fase 5.
- Server action `signOut` passata come prop dal Server Component (`AppShell`) al Client Component (`LogoutButton`): pattern Next.js 15 standard, build OK.

---

## 2026-04-28 — Fase 2.6 completata (logo PM come asset)

**Autore**: Federico + Claude
**Tempo**: ~10 min
**Fase corrente**: Fase 2

**Cosa fatto:**
- Estratto logo PM da base64 in `AppCore.html` v2 → `public/logo.png` (12KB PNG)
- `components/app-shell.tsx` usa `next/image` al posto del placeholder testo

**Validazione**: `npm run build` ✅ (10/10 routes, 0 warning)

---

## 2026-04-28 — Fase 3 completata (viste membro)

**Autore**: Federico + Claude
**Tempo**: ~2h
**Fase corrente**: Fase 4

**Cosa fatto:**
- `lib/db/queries.ts` — query Drizzle per balance, ciclo aperto, prodotti, ordini, ledger, storico
- `lib/actions/order.ts` — Server Action `saveOrder` (delete+insert, audit log, balance warning)
- `auth.ts` + `lib/auth/session.ts` — aggiunto `memberId`+`fullName` al JWT/session
- `lib/utils.ts` — helper `formatEur`, `formatEurSigned`, `formatDate`, `formatDateTime`
- **Home** (`app/page.tsx`): saldo hero card (orange/red), cycle card con `CycleCountdown` (timer live), order summary card, ultimi 4 movimenti
- **Ordine** (`app/ordine/page.tsx` + `order-form.tsx`): lista prodotti per categoria con pill stepper, sticky footer (fixed bottom-[82px]), `saveOrder` action con warning balance
- **Storico** (`app/storico/page.tsx` + `storico-tabs.tsx`): tab segmentato Ordini/Movimenti, ordini espandibili, balance summary, ledger con icone topup/charge
- **Guida** (`app/guida/page.tsx` + `faq-accordion.tsx`): how-to steps teal, FAQ accordion Client Component, contact card

**Validazione**: `npm run lint` + `npm run build` ✅ (14 files, 0 errori, 0 warning)
**Commit**: `29e714d [v3] feat: phase 3 member views`

**Cosa resta (next):**
- [ ] Smoke test cloud su Vercel (login → Home → ordine → storico → guida)
- [x] Fase 4 — Admin panel (5 tab: Ciclo, Prodotti, Ordini, Cassa, Soci) ← vedi entry successiva

**Note tecniche:**
- `cycleRestricted`: ciclo `access_level=attivi` + ruolo `socio` → stato "Nessun ordine aperto"
- Sticky footer ordine usa `fixed bottom-[82px]` (sopra BottomNav sticky) con spacer `h-36`
- `saveOrder` fa delete+insert (no transazione — scala GAS OK); audit_log sempre scritto
- Date serializzate come ISO string per passaggio Server→Client Component
- `memberId`+`fullName` ora nel JWT: evita query extra per ogni page load

---

## 2026-04-29 — Fase 4 completata (admin panel)

**Autore**: Federico + Claude
**Tempo**: ~2h
**Fase corrente**: Fase 5

**Cosa fatto:**
- `lib/db/queries.ts` — query admin: `getAllCycles`, `getOpenCycleStats`, `getAllSuppliers`, `getAllMembers`, `getAllMembersWithBalances`, `getAdminCycleSummary`, `getAdminCycleProducts`, `getAdminMemberLedger`
- `lib/actions/admin.ts` — Server Actions con `requireAdmin()` e audit log:
  - `adminCreateCycle`, `adminCloseCycle` (con generazione addebiti idempotente), `adminUpdateCycle`
  - `adminLoadProducts` (parser testo semicolon-delimited con validazione), `adminDuplicateProducts`
  - `adminRecordTopup`, `adminUpdateLedgerEntry`, `adminDeleteLedgerEntry`
  - `adminUpsertMember`
- **Tab Ciclo** (`tab-ciclo.tsx` + `ciclo-forms.tsx`): ciclo aperto con stats + badge teal, `CreateCycleForm` (form collapsibile), `CloseCycleButton` (confirm nativo + genera addebiti), lista ultimi cicli
- **Tab Prodotti** (`tab-prodotti.tsx` + `prodotti-forms.tsx`): `LoadProductsForm` (textarea + parser), `DuplicateProductsForm` (selettore ciclo + conferma), lista prodotti correnti
- **Tab Ordini** (`tab-ordini.tsx` + `ordini-client.tsx`): selettore ciclo via searchParams, stats 2-col, tabella per-prodotto, `OrdiniByMember` (righe espandibili), `CsvExportButton` (genera file CSV lato client)
- **Tab Cassa** (`tab-cassa.tsx` + `cassa-forms.tsx`): `TopupForm`, tabella saldi con link movimenti (`?tab=cassa&member=id`), `LedgerEntryRow` (edit inline + delete)
- **Tab Soci** (`tab-soci.tsx` + `soci-form.tsx`): `SociForm` (add/edit), `SociList` (gruppi attivi/soci, edit inline)
- `app/admin/page.tsx` — routing searchParams (`tab`, `cycle`, `member`), `<Suspense>` per ogni tab con skeleton, `<AdminNav>` (tab segmentata client-side)

**Validazione**: `npm run build` ✅ (10 routes, 0 errori, 0 warning)

**Cosa resta (next):**
- [ ] Smoke test cloud su Vercel (login admin → tutti e 5 i tab, crea ciclo, carica prodotti, registra topup, aggiorna socio)
- [ ] Fase 5 — PWA manifest + polish (skeleton, error boundaries, animazioni, Lighthouse)

**Note tecniche:**
- `adminCloseCycle` è idempotente: controlla se esistono già `order_charge` prima di inserirne di nuovi
- `genId(prefix)` → `prefix_` + 16 chars UUID (compatibile con formato v2)
- Tab navigation usa `?tab=XXX` searchParams: ogni tab è un RSC separato con proprio fetch
- `OrdiniByMember`: stato espansione locale, no URL params
- CSV export: generazione client-side da dati già fetchati (no round-trip aggiuntivo)
