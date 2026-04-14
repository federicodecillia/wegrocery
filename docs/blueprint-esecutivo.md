# Blueprint Esecutivo

## Progetto

- Nome operativo: `Porta Moneta GAS`
- Obiettivo: sostituire il Google Sheet condiviso con una web app molto semplice per gestire ordini settimanali e saldo soci
- Vincoli:
  - usare strumenti Google gratuiti o già inclusi nel piano nonprofit
  - minimizzare manutenzione
  - UX semplice per utenti poco tecnici
  - solo due ruoli: `member` e `admin`

## Decisione Architetturale

- Frontend: `Google Apps Script HTML Service`
- Backend: `Google Apps Script`
- Database operativo: `Google Sheets` in `Shared Drive`
- File storage: `Google Drive`
- Login: account Google
- Accesso:
  - `member`: può vedere e modificare solo i propri dati di ordine, vedere il proprio saldo e il proprio storico
  - `admin`: può fare tutto

Questa scelta e' la piu' semplice da implementare e mantenere senza costi aggiuntivi:

- niente server da amministrare
- hosting gia' incluso
- login Google integrato
- facile integrazione con Workspace
- dati esportabili e leggibili anche da foglio

## Principi di Semplicita'

- una sola web app
- una sola pagina principale per il socio
- una sola area admin con poche schermate
- nessun workflow complesso di approvazione
- niente ruoli intermedi
- niente configurazioni tecniche richieste agli utenti
- mobile-first

## Scope MVP

L'MVP deve coprire solo questo:

1. login Google
2. apertura ordine settimanale da parte admin
3. compilazione ordine personale da parte member
4. chiusura ordine
5. calcolo automatico addebito ordine
6. registrazione bonifici da parte admin
7. visualizzazione saldo e storico personale
8. export riepilogo per fornitore/admin

Fuori scope per MVP:

- notifiche push
- pagamento online
- multi-fornitore avanzato
- gestione magazzino
- gestione ritiri avanzata
- dashboard analitiche complesse
- automazioni bancarie

## User Types

### `member`

Puo':

- accedere con login Google
- vedere il ciclo ordine aperto
- inserire e modificare le proprie quantita' fino alla chiusura
- vedere totale stimato del proprio ordine
- vedere saldo attuale
- vedere storico ordini personale
- vedere storico movimenti personale

Non puo':

- vedere ordini altrui
- vedere saldi altrui
- modificare listino
- registrare bonifici
- riaprire o chiudere ordini

### `admin`

Puo':

- fare tutto quello che fa `member`
- gestire anagrafica membri
- aprire, modificare e chiudere i cicli ordine
- caricare e modificare listini
- vedere tutti gli ordini
- esportare totali per fornitore
- registrare bonifici e rettifiche
- vedere tutti i saldi
- eseguire import/export dati

## Flusso Utente Semplificato

### Flusso `member`

1. entra nella web app
2. vede subito:
   - stato ordine aperto/chiuso
   - saldo attuale
   - ultimo ordine
3. se ordine aperto:
   - seleziona le quantita'
   - salva
   - vede totale stimato aggiornato
4. dopo chiusura:
   - vede ordine congelato
   - vede addebito nello storico movimenti

### Flusso `admin`

1. crea nuovo ciclo ordine
2. inserisce data ritiro e chiusura ordine
3. carica prodotti e prezzi
4. monitora ordini in arrivo
5. chiude ordine
6. genera riepilogo totale prodotti
7. registra eventuali bonifici
8. controlla saldi

## UX Minima

## Pagina Home Member

Blocchi:

- `Saldo attuale`
- `Ordine della settimana`
- `Storico ultimi ordini`
- `Storico ultimi movimenti`

Azioni:

- `Salva ordine`
- `Azzera quantita'`

Regole UX:

- niente tabelle larghe con una colonna per utente
- un prodotto per riga
- input quantita' numerico molto evidente
- totale ordine sempre visibile in basso
- massimo 2 click per arrivare all'ordine aperto

## Pagina Admin

Sezioni:

- `Ciclo ordine`
- `Prodotti`
- `Ordini`
- `Bonifici`
- `Saldi`
- `Membri`

Regole UX:

- niente schermate tecniche
- liste essenziali
- pulsanti espliciti: `Apri ordine`, `Chiudi ordine`, `Registra bonifico`
- esportazioni in CSV o copia tabellare

## Modello Dati

Il dato va normalizzato. Non si usa piu' la matrice utenti x prodotti.

### Sheet `members`

Colonne:

- `member_id`
- `full_name`
- `email`
- `role`
- `active`
- `created_at`
- `updated_at`

Regole:

- `email` univoca
- `role` solo `member` o `admin`

### Sheet `order_cycles`

Colonne:

- `cycle_id`
- `title`
- `pickup_date`
- `order_open_at`
- `order_close_at`
- `status`
- `notes`
- `created_by`
- `created_at`
- `closed_at`

Valori `status`:

- `draft`
- `open`
- `closed`
- `archived`

### Sheet `products`

Colonne:

- `product_id`
- `cycle_id`
- `name`
- `variant`
- `format`
- `unit_price`
- `supplier`
- `notes`
- `sort_order`
- `active`

### Sheet `orders`

Una riga per prodotto ordinato da un socio.

Colonne:

- `order_line_id`
- `cycle_id`
- `member_id`
- `product_id`
- `quantity`
- `unit_price_snapshot`
- `line_total`
- `updated_at`

Regole:

- chiave logica univoca: `cycle_id + member_id + product_id`
- `line_total = quantity * unit_price_snapshot`
- se `quantity = 0`, la riga puo' essere omessa o cancellata

### Sheet `ledger_entries`

Colonne:

- `entry_id`
- `member_id`
- `entry_date`
- `type`
- `amount`
- `cycle_id`
- `note`
- `created_by`
- `created_at`

Valori `type`:

- `topup`
- `order_charge`
- `adjustment`

Regole:

- bonifico = importo positivo
- addebito ordine = importo negativo
- saldo = somma `amount` per `member_id`

### Sheet `audit_log`

Colonne:

- `audit_id`
- `user_email`
- `action`
- `entity_type`
- `entity_id`
- `payload_json`
- `created_at`

Serve per:

- tracciare modifiche admin
- facilitare debugging e contestazioni

## Derivate e Viste

Non serve salvare tutto in fogli separati. Alcune viste si generano da script:

- saldo corrente per membro
- totale ordine per membro
- totale prodotti per ciclo
- storico ordini per membro

## Regole Applicative

### Login

- accesso consentito solo a email presenti in `members`
- utente non censito: pagina `Accesso non autorizzato`

### Ordini

- un solo ciclo `open` alla volta nel MVP
- il member puo' modificare solo ordini del ciclo `open`
- a chiusura ordine, nessuna modifica ulteriore per i member
- l'admin puo' correggere ordini anche dopo chiusura se necessario

### Contabilita'

- alla chiusura del ciclo, il sistema genera automaticamente un `order_charge` per ogni member con totale ordine > 0
- ogni bonifico inserito da admin genera un `topup`
- eventuali correzioni manuali sono `adjustment`

### Sicurezza

- i member non accedono mai direttamente al file Sheet sorgente
- il browser parla solo con la web app
- il backend filtra sempre per `member_id` dell'utente loggato
- il frontend non decide mai i permessi

## Architettura Tecnica

## Apps Script

Moduli previsti:

- `Auth.gs`
- `Members.gs`
- `Cycles.gs`
- `Products.gs`
- `Orders.gs`
- `Ledger.gs`
- `Audit.gs`
- `Views.gs`
- `Validation.gs`
- `Utils.gs`

## Frontend

File previsti:

- `Index.html`
- `Styles.html`
- `App.html`
- `MemberView.html`
- `AdminView.html`
- `app.js`

Approccio frontend:

- HTML semplice
- CSS minimale, pulito e mobile-first
- vanilla JavaScript
- nessun framework

## API interne Apps Script

Metodi minimi:

- `getCurrentSession()`
- `getOpenCycle()`
- `getMemberDashboard()`
- `saveMyOrder(payload)`
- `getMyOrderHistory()`
- `getMyLedger()`
- `adminCreateCycle(payload)`
- `adminUpdateProducts(payload)`
- `adminCloseCycle(cycleId)`
- `adminRecordTopup(payload)`
- `adminGetBalances()`
- `adminGetCycleSummary(cycleId)`

## Schermate Dettagliate

## `member` dashboard

Campi visibili:

- nome socio
- saldo attuale
- stato ordine
- data chiusura ordine

Lista prodotti:

- prodotto
- variante
- formato
- prezzo
- note
- quantita'
- subtotale riga

Footer:

- totale ordine stimato
- pulsante `Salva ordine`

Storico:

- ultimi 5 ordini
- ultimi 10 movimenti

## `admin` dashboard

Widget:

- ordine aperto attuale
- numero soci che hanno ordinato
- totale stimato ciclo
- membri con saldo negativo

Tab `Ciclo ordine`:

- apri nuovo ciclo
- modifica titolo/date/note
- chiudi ciclo

Tab `Prodotti`:

- aggiungi prodotto
- modifica prodotto
- disattiva prodotto
- duplica listino da ultimo ciclo

Tab `Ordini`:

- vista riepilogo per socio
- vista riepilogo per prodotto

Tab `Bonifici`:

- membro
- data
- importo
- nota
- salva

Tab `Saldi`:

- membro
- saldo
- ultimo movimento

Tab `Membri`:

- nome
- email
- ruolo
- attivo

## Strategia Dati e Permessi

### Storage

- file Google Sheets principale in Shared Drive
- accesso editor al file solo per admin tecnici
- gli utenti finali non aprono mai il foglio dati

### Deployment

- deploy come web app Apps Script
- esecuzione come proprietario script
- accesso limitato agli utenti autorizzati dall'applicazione

Nota:

- se la web app viene limitata agli utenti Workspace del dominio, serve decidere se i soci avranno account del dominio
- se i soci usano Gmail esterni, va verificata la configurazione di accesso della web app e la gestione allowlist nel dataset `members`

## Migrazione dal File Attuale

Obiettivo MVP migrazione:

- non importare tutte le strutture del vecchio file
- importare solo dati puliti e necessari

### Da importare

- anagrafica soci
- storico saldi iniziali
- eventualmente ultimi 3-6 mesi di ordini

### Da non importare pari pari

- formule inter-sheet
- layout settimanali
- righe vuote
- anomalie del foglio storico

### Strategia consigliata

1. costruire nuova app con dataset vuoto
2. importare `members`
3. calcolare e caricare un `saldo iniziale` per ogni socio in `ledger_entries`
4. partire live da una data precisa
5. tenere il file storico solo come archivio read-only

## Validazioni

Per ogni scrittura, definire sempre target, mode e controlli.

### Salvataggio ordine

- target: sheet `orders`
- mode: `upsert` per `cycle_id + member_id + product_id`
- controlli:
  - ciclo aperto
  - utente autorizzato
  - quantita' >= 0
  - prodotto appartenente al ciclo aperto

### Chiusura ciclo

- target: sheet `ledger_entries`
- mode: `insert`
- controlli:
  - nessun altro ciclo aperto
  - nessun doppio `order_charge` per stesso `cycle_id + member_id`
  - quadratura totale ciclo

### Registrazione bonifico

- target: sheet `ledger_entries`
- mode: `insert`
- controlli:
  - membro esistente
  - importo > 0
  - data valida

### Gestione membri

- target: sheet `members`
- mode: `insert/update`
- controlli:
  - email univoca
  - ruolo valido

## Test Minimi

Test funzionali minimi:

1. member vede solo il proprio saldo
2. member non puo' leggere ordini di altri membri
3. member puo' salvare un ordine aperto
4. member non puo' modificare un ordine chiuso
5. admin puo' aprire e chiudere un ciclo
6. chiusura ciclo genera addebiti corretti
7. bonifico aumenta il saldo corretto
8. saldo finale = somma ledger

Test dati:

1. nessun duplicato `cycle_id + member_id + product_id`
2. nessun duplicato `entry_id`
3. importi ledger numerici
4. prodotti con prezzo valido

## Backlog di Implementazione

## Sprint 1

- creare spreadsheet dati
- creare schema sheet
- creare bootstrap members
- creare auth e sessione utente
- creare dashboard member base

## Sprint 2

- creare gestione ciclo ordine
- creare CRUD prodotti
- creare salvataggio ordine personale
- creare totale stimato

## Sprint 3

- creare chiusura ciclo
- creare ledger
- creare registrazione bonifici
- creare saldo personale

## Sprint 4

- creare storico ordini
- creare storico movimenti
- creare export admin
- test end-to-end

## Criteri di Accettazione MVP

L'MVP e' accettato se:

1. un socio accede e vede solo il proprio account
2. un socio inserisce il proprio ordine in meno di 2 minuti
3. admin apre un nuovo ciclo in meno di 5 minuti
4. admin chiude il ciclo e ottiene i totali prodotti senza formule manuali
5. admin registra un bonifico in meno di 30 secondi
6. il saldo mostrato al socio coincide con la somma dei movimenti ledger
7. nessun socio puo' modificare o leggere la contabilita' altrui

## Piano di Delivery

### Fase 1. Setup

- creare spreadsheet base
- creare script project
- configurare dataset iniziali

### Fase 2. MVP member

- login
- dashboard
- ordine aperto
- storico base

### Fase 3. MVP admin

- membri
- prodotti
- ciclo ordine
- bonifici
- saldi

### Fase 4. Go-live

- caricamento membri reali
- caricamento saldo iniziale
- test con 2-3 utenti pilota
- avvio su primo ciclo reale

## Decisioni Bloccate Gia' Prese

- stack: `Google Apps Script + Google Sheets`
- ruoli: solo `member` e `admin`
- modello dati normalizzato
- contabilità separata dagli ordini
- UI essenziale
- niente accesso diretto dei soci ai fogli dati

## Prossimo Output Tecnico Consigliato

Dopo questo blueprint, il prossimo deliverable dovrebbe essere:

1. schema fisico dei fogli con intestazioni definitive
2. struttura del progetto Apps Script
3. backlog tecnico task-by-task
4. implementazione MVP
