# Piano Rebuild: Porta Moneta GAS

## Contesto

L'APS Porta Moneta gestisce un GAS (Gruppo di Acquisto Solidale) usando un Google Sheet condiviso dove ~15 soci ordinano frutta e verdura settimanalmente. Problemi principali:
- **Sicurezza zero**: chiunque modifica ordini e saldi altrui
- **UX mobile pessima**: matrice prodotti×soci illeggibile da telefono
- **Dati fragili**: formule rotte, layout colonne inconsistente tra sheet, errori (#VALUE!)
- **Nessuna tracciabilità**: niente login, niente storico personale

**Obiettivo**: Ricostruire da zero una web app Google Apps Script con UX mobile-first, ruoli separati (member/admin), e contabilità protetta. Costo hosting: €0 (Google Workspace for Nonprofits).

## Dati reali dal file Excel

- **15 soci**: Di Mauro, Malacrinò, Miglierina, Gianquinto, Di Simine, Favalli, Riva Cafora, Eva, Nazareno, Maria Fois, Ballabio, Cucchiara A., Cadelano L., Rossin-Ravelli, Porta Moneta (associazione — trattata come socio regolare)
- **17-25 prodotti/settimana**: verdure e frutta con Prodotto, Varietà, Formato, €/pezzo, €/kg, Note fornitore
- **19 cicli d'ordine** (nov 2025 – apr 2026)
- **Saldi attuali** (dal foglio CASSA): da -€34.60 (Miglierina) a +€39.25 (Rossin-Ravelli)
- **3 giri di bonifici** finora, importi variabili (€9.30 – €100)

---

## Stack Tecnologico

- **Backend**: Google Apps Script (.gs)
- **Frontend**: Vanilla HTML/CSS/JS (.html inclusi via `<?!= include('file') ?>`)
- **Database**: Google Sheets (6 tabelle normalizzate)
- **Hosting**: Google Apps Script Web App (incluso in Workspace)
- **Auth**: Google Account login (via `Session.getActiveUser()`)
- **Deploy**: `clasp push` da locale

---

## Struttura File

Tutto il codice sorgente va in `app_gas/src/`.

### Backend (.gs)

| File | Responsabilità |
|------|----------------|
| `Config.gs` | Costanti, nomi sheet, headers, enum |
| `Utils.gs` | Helper: `nowIso_`, `generateId_`, `assert_`, `include` per HTML |
| `Storage.gs` | CRUD sheet: `readSheetObjects_`, `overwriteSheetObjects_`, `appendSheetObject_`, `appendSheetObjects_` (batch), `readSheetObjectsWhere_` (filtered read) |
| `Auth.gs` | `requireSession_`, `requireAdmin_`, lookup member by email |
| `Main.gs` | `doGet()`, `callApi()` dispatcher |
| `Members.gs` | CRUD soci: `adminGetMembers`, `adminUpsertMember` |
| `Cycles.gs` | Cicli: `adminCreateCycle`, `adminCloseCycle`, `adminGetRecentCycles`, `getOpenCycle` |
| `Products.gs` | Prodotti: `adminUpdateProducts`, `adminDuplicateProducts` |
| `Orders.gs` | Ordini member: `getMemberDashboard`, `saveMyOrder`, `getMyOrderHistory`, `getMyOrderDetail` |
| `Ledger.gs` | Contabilità: `adminRecordTopup`, `adminGetBalances`, generazione addebiti alla chiusura ciclo |
| `Audit.gs` | Log azioni admin (append-only) |
| `Setup.gs` | `setupDataStore`, `seedSampleData` |
| `Migration.gs` | Funzioni one-time per importare soci e saldi iniziali |
| `Test.gs` | Smoke test espansi |

### Frontend (.html)

| File | Responsabilità |
|------|----------------|
| `Index.html` | Shell HTML: bottom nav, container sezioni, loading screen |
| `Styles.html` | CSS mobile-first: design system, stepper, sticky footer, bottom nav, toast |
| `AppCore.html` | JS core: `PM` namespace, API wrapper (Promise), router hash-based, toast, confirm dialog |
| `AppMember.html` | Logica member: init dashboard, gestione draft ordine |
| `AppAdmin.html` | Logica admin: init pannello, dispatch azioni admin |
| `ComponentMemberHome.html` | Dashboard: saldo, stato ciclo, azioni rapide |
| `ComponentOrderForm.html` | **Il pezzo chiave**: lista prodotti con stepper +/−, totale sticky |
| `ComponentHistory.html` | Storico ordini e movimenti contabili |
| `ComponentAdminCycle.html` | Gestione ciclo: crea, chiudi, stato |
| `ComponentAdminProducts.html` | Prodotti: testo libero, duplica da ciclo precedente, modifica singolo |
| `ComponentAdminOrders.html` | Riepilogo ordini per prodotto/socio, export |
| `ComponentAdminLedger.html` | Bonifici: form registrazione, tabella saldi |
| `ComponentAdminMembers.html` | Gestione anagrafica soci |

### Config

| File | Responsabilità |
|------|----------------|
| `.clasp.json` | Config clasp: `scriptId`, `rootDir: "src"` |
| `src/appsscript.json` | Manifest Apps Script |

---

## Modello Dati (Google Sheets)

6 sheet normalizzati in un unico Spreadsheet. Nessuna formula — tutti i valori derivati sono calcolati server-side.

### `members` (7 colonne)
`member_id` · `full_name` · `email` · `role` · `active` · `created_at` · `updated_at`
- `email` univoca, usata come chiave di login
- `role`: `member` o `admin` (più persone possono essere admin)

### `order_cycles` (10 colonne)
`cycle_id` · `title` · `pickup_date` · `order_open_at` · `order_close_at` · `status` · `notes` · `created_by` · `created_at` · `closed_at`
- `status`: `draft` → `open` → `closed` → `archived`
- Un solo ciclo `open` alla volta

### `products` (10 colonne)
`product_id` · `cycle_id` · `name` · `variant` · `format` · `unit_price` · `supplier` · `notes` · `sort_order` · `active`

### `orders` (8 colonne)
`order_line_id` · `cycle_id` · `member_id` · `product_id` · `quantity` · `unit_price_snapshot` · `line_total` · `updated_at`
- Chiave logica univoca: `cycle_id + member_id + product_id`
- `line_total = quantity × unit_price_snapshot`

### `ledger_entries` (9 colonne)
`entry_id` · `member_id` · `entry_date` · `type` · `amount` · `cycle_id` · `note` · `created_by` · `created_at`
- `type`: `topup` (positivo), `order_charge` (negativo), `adjustment`
- **Saldo socio = SUM(amount) WHERE member_id**

### `audit_log` (7 colonne)
`audit_id` · `user_email` · `action` · `entity_type` · `entity_id` · `payload_json` · `created_at`

### Convenzioni ID
Prefisso per tipo: `mem_*`, `cyc_*`, `prd_*`, `ord_*`, `led_*`, `aud_*`

---

## UX Design

### Form Ordine Mobile (il pezzo chiave)

Ogni prodotto diventa una card (non riga di tabella):

```
┌─────────────────────────────────┐
│ Carote                          │
│ Varietà mista · 500g · €1.80    │
│                                 │
│     [ − ]    2    [ + ]         │
│                     €3.60       │
└─────────────────────────────────┘
```

- Bottoni **−** / **+** grandi (min 48×48px, ideale 56px)
- Quantità tra i bottoni (font 24px+)
- Subtotale sotto lo stepper
- Card a piena larghezza, una per riga
- Prodotti con quantità 0: opacità ridotta
- Prodotti con quantità > 0: bordo verde a sinistra

**Footer sticky** sempre visibile:
```
┌─────────────────────────────────┐
│ Totale: €12.40       [ SALVA ]  │
│ Saldo dopo ordine: €26.85      │
└─────────────────────────────────┘
```

- Salvataggio: toast verde "Ordine salvato ✓" per 3 secondi
- UI ottimistica: aggiornamento locale immediato al tap +/−, sync al salvataggio

### Navigazione Member (Bottom Nav, 3 tab)

1. **Home** — Saldo prominente, stato ciclo aperto/chiuso, ultimo ordine, ultimo bonifico
2. **Ordine** — Form prodotti con stepper (badge se ciclo aperto)
3. **Storico** — Due sotto-tab: Ordini (ultimi 10 cicli, espandibili) e Movimenti (ledger)

### Navigazione Admin (4 tab)

Stessi 3 tab member + **Admin** (icona ingranaggio) con sotto-sezioni tab:
- **Ciclo**: Crea nuovo, chiudi con conferma, stato e conteggio ordini
- **Prodotti**: Testo libero (Nome;Varietà;Formato;Prezzo), duplica da ultimo ciclo, modifica singolo
- **Ordini**: Riepilogo per prodotto (per il fornitore) e per socio, export copia-incolla
- **Bonifici**: Form veloce (dropdown socio, data, importo, nota), lista recenti
- **Saldi**: Tabella tutti i soci con saldo, evidenziazione rossa per negativi
- **Soci**: Lista con add/edit, toggle attivo/inattivo

**Decisione critica**: L'admin ha ANCHE il tab Ordine per piazzare il proprio ordine. Il pannello admin è un tab aggiuntivo, non sostitutivo della vista member.

---

## Sicurezza

- Tutte le verifiche auth sono server-side (`requireSession_`, `requireAdmin_`)
- Il frontend NON decide mai i permessi — è solo cosmetico
- I member accedono solo ai propri dati (filtro `member_id` server-side)
- I member non vedono mai ordini o saldi altrui
- Solo admin possono: gestire cicli, prodotti, bonifici, soci, e vedere tutti i saldi
- Audit log su ogni operazione admin

---

## API Endpoints

### Session
- `getCurrentSession` → { member_id, full_name, email, role }

### Member (requireSession)
- `getMemberDashboard` → saldo, ciclo aperto, prodotti, righe ordine, totale
- `saveMyOrder` → { cycle_id, lines: [{product_id, quantity}] }
- `getMyOrderHistory` → ultimi 10 cicli con totali
- `getMyOrderDetail` → { cycle_id } → righe ordine di un ciclo specifico
- `getMyLedger` → ultimi 25 movimenti contabili

### Admin (requireAdmin)
- `adminCreateCycle` → { title, pickup_date, order_open_at, order_close_at }
- `adminCloseCycle` → { cycle_id } — genera automaticamente `order_charge` per ogni socio
- `adminUpdateProducts` → { cycle_id, products: [...] }
- `adminDuplicateProducts` → { source_cycle_id, target_cycle_id }
- `adminGetCycleSummary` → { cycle_id } → aggregazioni per prodotto e per socio
- `adminGetRecentCycles` → ultimi 10 cicli (per feature duplica prodotti)
- `adminRecordTopup` → { member_id, entry_date, amount, note }
- `adminGetBalances` → tutti i soci con saldo corrente
- `adminUpsertMember` → { full_name, email, role, active }
- `adminGetMembers` → tutti i soci (anche inattivi)

---

## Miglioramenti Storage.gs

Rispetto al precedente prototipo, aggiungere:

1. **`readSheetObjectsWhere_(sheetName, filterCol, filterValue)`** — legge solo righe dove `filterCol === filterValue`. Evita di caricare tutti gli ordini di tutti i cicli quando ne servono solo quelli del ciclo corrente.

2. **`appendSheetObjects_(sheetName, headers, objects)`** — batch append di più righe (per generare addebiti alla chiusura ciclo senza N chiamate separate).

Mantenere `readSheetObjects_`, `overwriteSheetObjects_`, `appendSheetObject_` invariati.

---

## Frontend Architecture

### Pattern Component su namespace PM

```javascript
// AppCore.html — fornisce:
const PM = {
  state: { session: null, dashboard: null, view: 'loading' },
  api(action, payload) { /* google.script.run wrapper → Promise */ },
  navigate(view) { /* show/hide sezioni via hash routing */ },
  toast(message, type) { /* feedback temporaneo */ },
  confirm(message) { /* modal conferma → Promise */ },
  formatCurrency(v) { /* Intl.NumberFormat it-IT EUR */ }
};
```

Ogni Component si registra:
```javascript
// ComponentOrderForm.html
PM.components.orderForm = {
  render(container, data) { /* genera HTML, bind eventi */ },
  onQuantityChange(productId, delta) { /* aggiorna draft, ricalcola totale */ }
};
```

**Routing**: hash-based (`#home`, `#ordine`, `#storico`, `#admin/ciclo`, ecc.) con `window.onhashchange`.

**Lingua**: 100% italiano — UI, messaggi errore, date (`dd/mm/yyyy`), valuta (€ con virgola decimale).

---

## Strategia di Migrazione

`Migration.gs` con funzioni da eseguire una tantum dall'editor Apps Script:

### 1. `migrateMembers()`
Array hard-coded dei 15 soci con nome, email, ruolo. Le email verranno fornite in fase di migrazione. Più persone avranno ruolo admin.

### 2. `migrateInitialBalances()`
Un `ledger_entry` di tipo `adjustment` per socio con saldo snapshot dal foglio CASSA:

| Socio | Saldo |
|-------|-------|
| Di Mauro | +€6.90 |
| Malacrinò | -€5.55 |
| Miglierina | -€34.60 |
| Gianquinto | +€6.50 |
| Di Simine | -€11.40 |
| Favalli | -€12.05 |
| Riva Cafora | +€4.90 |
| Eva | -€4.00 |
| Nazareno | +€7.80 |
| Maria Fois | -€10.70 |
| Ballabio | +€2.20 |
| Cucchiara A. | €0.00 |
| Cadelano L. | €0.00 |
| Rossin-Ravelli | +€39.25 |
| Porta Moneta | -€18.50 |

**Nota**: Questi saldi vanno aggiornati al momento del cutover effettivo (potrebbero cambiare nel frattempo).

### Piano di cutover
1. Build app con dataset vuoto
2. Eseguire `migrateMembers()` con email reali
3. Eseguire `migrateInitialBalances()` con saldi aggiornati al giorno del cutover
4. Go live dal prossimo ciclo d'ordine
5. Vecchio Google Sheet → read-only come archivio

---

## Ordine di Implementazione

### Fase 1 — Backend
Ricreare tutti i .gs con struttura modulare. Testabile dall'editor GAS senza frontend.
- `Config.gs`, `Utils.gs`, `Storage.gs`, `Auth.gs`, `Main.gs`
- `Members.gs`, `Cycles.gs`, `Products.gs`, `Orders.gs`, `Ledger.gs`
- `Audit.gs`, `Setup.gs`, `Test.gs`

### Fase 2 — Frontend Core
- `Styles.html` — design system CSS mobile-first
- `AppCore.html` — namespace PM, API wrapper, router, toast, confirm
- `Index.html` — shell con bottom nav e container sezioni

### Fase 3 — UX Member (Home + Order Form)
- `ComponentMemberHome.html` — dashboard con saldo e stato ciclo
- `ComponentOrderForm.html` — form ordine con stepper +/−, footer sticky
- `AppMember.html` — logica member

### Fase 4 — Storico Member
- `ComponentHistory.html` — storico ordini espandibile + movimenti contabili

### Fase 5 — Pannello Admin
- `ComponentAdminCycle.html`, `ComponentAdminProducts.html`, `ComponentAdminOrders.html`
- `ComponentAdminLedger.html`, `ComponentAdminMembers.html`
- `AppAdmin.html` — logica admin

### Fase 6 — Migration, Test, Deploy
- `Migration.gs` — import soci e saldi
- Test end-to-end su mobile
- Deploy production via `clasp push`

---

## Verifica e Test

### Test automatici (Test.gs, da eseguire nell'editor GAS)
1. Member vede solo il proprio saldo
2. Member non può leggere ordini di altri
3. Member può salvare un ordine su ciclo aperto
4. Member NON può modificare un ordine su ciclo chiuso
5. Admin può aprire e chiudere un ciclo
6. Chiusura ciclo genera addebiti corretti
7. Bonifico aumenta il saldo corretto
8. Saldo = SUM(ledger_entries)

### Test manuali (per ogni deploy)
1. `clasp push` → deploy come web app
2. Aprire da mobile → login Google funzionante
3. Come member: ordinare 3-4 prodotti → salvare → toast + totale corretto
4. Come admin: creare ciclo → caricare prodotti → chiudere → verificare addebiti
5. Registrare un bonifico → verificare saldo aggiornato
6. Verificare che member NON possa accedere a endpoint admin
7. Test su iPhone Safari e Android Chrome

---

## Regole di Business Principali

- Un solo ciclo `open` alla volta
- Il member può modificare il proprio ordine solo finché il ciclo è `open`
- Alla chiusura ciclo, il sistema genera automaticamente un `order_charge` (negativo) per ogni socio con totale ordine > 0
- Ogni bonifico inserito da admin genera un `topup` (positivo)
- Correzioni manuali sono `adjustment`
- Saldo = somma algebrica di tutti i `ledger_entries` del socio
- Email è la chiave univoca per i soci (usata per login Google)
- Nessun accesso diretto dei soci al foglio Sheets — solo tramite web app
