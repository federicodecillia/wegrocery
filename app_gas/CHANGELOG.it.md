# Cosa è cambiato

Tutte le modifiche importanti all'app Porta Moneta GAS sono elencate qui.

Il formato segue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
e il versionamento è basato su [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **Major** — modifiche grosse che richiedono ai soci di reimparare qualcosa
- **Minor** — funzionalità nuove, nessuna rottura
- **Patch** — correzioni di bug, piccoli miglioramenti UI, documentazione

> 🇬🇧 The English version of this file is [CHANGELOG.md](./CHANGELOG.md).
> Le due versioni devono restare sincronizzate.

---

## [Non rilasciato]

---

## [1.6.0] — 2026-05-21

### Aggiunte
- **Distinta fornitore `.xlsx` con flusso di andata e ritorno.** Quando premi 📧 Fornitore la mail allega ora un foglio Excel con lo stesso layout che i fornitori già usano: prodotti come righe, soci come colonne, celle gialle pre-compilate con i prezzi originali, una riga "Spedizione" in fondo e formule `=SUM(...)` live per i totali per socio e per prodotto. Le colonne di riferimento (prodotto/varietà/formato/€/pz/€/kg/note) sono bloccate per evitare che la struttura venga rotta. Un foglio nascosto `_meta` porta cycleId + le mappe prodotti/soci, così il file si può ricaricare senza dover incrociare i nomi. Quando il fornitore ha pesato tutto e ti rimanda il file, il nuovo bottone **📤 Carica distinta fornitore** dentro "Vedi ordini" lo legge, mostra un'anteprima dei cambiamenti (rettifiche riga, spedizione per socio, eventuali avvisi) e in un click applica tutto — le correzioni riga passano dalle stesse voci `correction` nel saldo delle rettifiche manuali, mentre la spedizione per socio viene scritta direttamente nel ledger e il ciclo passa a `shippingMode = "manual"` per evitare che future modifiche la sovrascrivano. In modalità manuale il form del ciclo mostra un banner arancione al posto del campo spedizione. Il formato si apre con Excel, LibreOffice e Google Sheets senza conversioni.
- **Spedizione visibile nel modale "Vedi ordini".** Nella sezione di ogni socio dentro Admin → Ciclo → Recap ordini compare ora una riga 🚚 Spedizione sotto le righe prodotto, e il subtotale per socio in alto la include. Prima il modale mostrava solo i prodotti, quindi i totali a schermo non tornavano con l'addebito reale (`order_charge + shipping_charge`).
- **Filtri in Admin → Statistiche.** Tre tendine in alto nella dashboard permettono di filtrare ogni card e grafico per ciclo, fornitore o socio (combinabili). Un link "Rimuovi filtri" li azzera con un click. Utile per rispondere a "quanto ci ha fatturato il fornitore X negli ultimi 3 cicli?" o "cosa ha ordinato Chiara quest'anno?".
- **Backup settimanale del database su Google Drive.** Una GitHub Action gira ogni domenica alle 03:00 UTC, fa il dump del database Neon di produzione con `pg_dump`, lo comprime in gzip e lo carica su `gdrive:PortaMoneta/GAS-Backups/` via rclone. Si aggiunge alla finestra di restore di 7 ore offerta dal piano free di Neon, così possiamo ripristinare anche da uno snapshot vecchio di una settimana in caso di perdita o corruzione dati. La procedura di setup e di restore è documentata nel `CLAUDE.md` del progetto.
- **Modifica di un ciclo anche dopo la chiusura.** I cicli chiusi nella lista "Ultimi cicli" hanno ora un pulsante ✎ Modifica accanto a "Recap ordini". L'admin può correggere titolo, note, date di ritiro e spese di spedizione senza riaprire il ciclo. Il form disabilita esplicitamente i campi che non ha senso toccare a ciclo chiuso (chiusura ordini, fornitore, livello di accesso).
- **Ricalcolo automatico della spedizione sui cicli chiusi.** Quando l'admin cambia modalità o importo della spedizione su un ciclo chiuso, le voci `shipping_charge` nel saldo dei soci vengono aggiornate in posto per ogni socio con ordine. Ogni socio coinvolto riceve una notifica `order_adjusted` con la vecchia e la nuova quota, e una voce `cycle_shipping_recomputed` viene scritta nell'audit log con il prima/dopo.
- **Invio dell'ordine al fornitore via email.** Nuovo pulsante 📧 Fornitore su ogni ciclo chiuso. Manda una mail (via Resend) al fornitore del ciclo, con l'admin che ha cliccato **e `gas@portamoneta.org` (l'archivio condiviso del GAS)** in CC, e in allegato un CSV aggregato per prodotto (una riga per articolo con quantità e totale sommati). Disabilitato con tooltip esplicativo se il ciclo non ha un fornitore o se il fornitore non ha un'email. La configurazione di Resend è documentata in `SETUP.md`.
- **Registrazione di quanto effettivamente consegnato, riga per riga.** Dentro al modale "Recap ordini" ogni riga d'ordine è ora cliccabile: l'admin può inserire quantità reale ricevuta e costo effettivo (es. ordinato 1 kg di bietola, arrivati 800 g → €1,60 invece di €2,00). La differenza viene scritta come voce `correction` nel saldo, il totale del socio si aggiorna subito e arriva una notifica `order_adjusted` con il dettaglio. Le righe rettificate sono marcate "rettificato" e mostrano ordinato vs ricevuto fianco a fianco.

### Modificato
- **Admin → Cassa apre con tre card riassuntive.** Saldo totale dei soci attivi, saldo medio per socio attivo e una card "Saldo < 0" cliccabile che attiva un filtro sulla lista sotto per vedere solo i soci in rosso. La card del saldo negativo prima viveva in Admin → Ciclo dove era facile mancarla; ora sta accanto alle altre cifre di saldo a cui appartiene.
- **Le card in alto in Admin → Ciclo sono ora una timeline dei cicli.** Tre contatori al volo — Aperti / In scadenza (≤7 giorni) / Chiusi (ultimi 7 giorni) — sostituiscono le vecchie "Saldo < 0" e "Top 30 giorni". La finestra "in scadenza" passa da 24 h a 7 giorni così la card serve per pianificare, non solo per andare nel panico.
- **I filtri in Admin → Statistiche ora supportano la selezione multipla.** Ogni menu (cicli, fornitori, soci) consente di spuntare più voci con una casella di ricerca integrata; nessuna selezione = "tutti". Card, grafici e classifiche si adattano al filtro combinato. I parametri URL passano da singolo id a lista separata da virgole, così una vista filtrata resta condivisibile per link.
- **Il template di Admin → Prodotti è ora un file Excel (`.xlsx`).** Un esempio per ogni categoria GAS comune — Frutta, Verdura, Pane e cereali, Pasta e riso, Latticini, Uova, Carne, Conserve, Olio e aceto — arriva pre-compilato in corsivo così da poterli adattare in loco. Il bottone di import ora accetta sia `.xlsx` che il vecchio `.csv`.
- **"Riepilogo ordini" nell'xlsx del fornitore è ora ordinato per prodotto, poi varietà.** Prima le righe erano raggruppate per socio, rendendo difficile leggere i totali di un singolo prodotto. La matrice (foglio Distinta) è invariata.
- **Layout più pulito di "Ultimi cicli" da mobile.** La pillola "Chiuso" è passata a sinistra del titolo del ciclo così si legge come etichetta di stato, non come bottone. I tre bottoni d'azione (Modifica, Fornitore, Ordini) vanno a capo su una loro riga sotto, invece di schiacciarsi accanto al titolo. "Modifica ciclo" rinominato in solo "Modifica".
- **I bottoni di download Excel ora dicono "Scarica Excel"** ovunque (admin → Fornitore hub e admin → Ordini), al posto del tecnico "Scarica .xlsx".
- **Il bottone 🤝 Fornitore non è più disabilitato quando il fornitore non ha email registrata.** Anche senza destinatario pre-compilato il dialog è utile — l'admin può scrivere l'indirizzo a mano per quel singolo invio, e le sezioni "Scarica Excel" e "Carica distinta" sono indipendenti dalla configurazione email. Il bottone resta disabilitato solo quando il ciclo non ha proprio un fornitore associato.
- **Tutte le azioni fornitore raccolte in un unico dialog 🤝 Fornitore.** La riga del ciclo chiuso ora ha tre bottoni, in quest'ordine: `✎ Modifica ciclo`, `🤝 Fornitore`, `✎ Ordini`. Il nuovo dialog hub raggruppa in un solo punto: 📥 Scarica riepilogo ordini (l'xlsx canonico), 📧 Invia per email (gli stessi 4 campi editabili — Destinatario/Mittente/CC/Oggetto), 📤 Carica distinta compilata (upload + anteprima diff + apply). I vecchi bottoni "Carica distinta" e "CSV fornitore" dentro Recap ordini sono spariti — non era il posto giusto. L'export "Esporta CSV" in Admin → Ordini ora scarica lo stesso xlsx del hub (un solo file in giro, niente più formati che divergono).
- **Un unico xlsx canonico** circola: l'allegato della mail, il download dal hub e l'export in Admin → Ordini producono lo stesso workbook. Ora ha tre sheet: `Distinta` (la matrice editabile, invariata), `Riepilogo ordini` (read-only, una riga per socio×prodotto con Qta ordinata · Prezzo unitario · Totale) e `Totali per prodotto` (read-only, aggregato). Il foglio nascosto `_meta` per il re-import è invariato.
- **Quantità ordinata come nota sulla cella nell'xlsx.** Passando il mouse su una cella gialla nello sheet `Distinta` compare ora "Ordinato: 2 pz" (o l'unità rilevante), così il fornitore vede la quantità di riferimento senza inquinare il valore numerico della cella editabile.
- **Formato coerente per le righe dentro Recap ordini.** Le righe rettificate prima leggevano `1 = €2,55` mentre quelle non rettificate `1 × €1,50 = €1,50`. Ora entrambe usano il formato `qty × prezzo_unitario = totale`; le righe rettificate mostrano una riga struck "ordinato" sopra una riga bold "effettivo", con il prezzo unitario effettivo ricavato da totale_effettivo / qta_effettiva.
- **La conferma di 📧 Fornitore diventa un dialog modificabile.** Prima si apriva un confirm con un unico paragrafo dove Destinatario / Oggetto / CC erano tutti attaccati. Ora si apre un form compatto: ciascun campo dell'intestazione (Destinatario, Mittente, CC, Oggetto) sta su una riga propria, in monospace a 12 px, ed è modificabile per quel singolo invio. Default pre-compilati con l'email del fornitore del ciclo + `MAIL_FROM` + l'admin che ha cliccato + `gas@portamoneta.org`. CC accetta indirizzi separati da virgola. Il Mittente ha una nota che ricorda che deve essere un dominio verificato in Resend.
- **I totali in Admin → Ordini ora includono rettifiche e spedizione.** La cifra per socio mostrava il subtotale prodotti originale anche dopo che l'admin aveva rettificato i pesi o aggiunto la spedizione — la riga di Chiara segnava €3,75 quando in realtà le era stato addebitato di più. La sezione "Per socio" è ora la prima (è la vista più utile) e i totali riflettono l'importo effettivo: `actual_line_total` dove presente, più le voci `shipping_charge` del socio. Sotto c'è "Per prodotto" con i subtotali a prezzo post-rettifica (la spedizione è esclusa lì, perché non è legata a un prodotto).
- **"Fatturato" rinominato in "Spesa"** in tutta Admin → Statistiche — etichetta della card in alto, titolo del grafico trend, intestazione del ranking fornitori. "Spesa totale" include ora anche la spedizione, così corrisponde a quanto i soci hanno effettivamente pagato, non solo ai subtotali prodotti.
- **Il CSV esportato da Admin → Ordini è ora identico al "CSV fornitore"** che si scarica dal modale "Vedi ordini": stessa intestazione (`Fornitore;Prodotto;Varietà;Formato;Unità;Socio;Quantità;Prezzo unitario;Totale (€)`), stesso raggruppamento per fornitore, stessa virgola decimale italiana e BOM UTF-8 per Excel. Un unico builder client condiviso, così i due punti di export non possono più divergere.

### Risolto
- **Errore server in Admin → Statistiche quando si filtrava per ciclo o fornitore.** Selezionare un filtro ciclo o fornitore faceva crashare la pagina con un generico "Qualcosa è andato storto" perché la SQL sottostante usava `= ANY($1::text[])` per bindare gli array dei multi-select — ma il driver Neon HTTP non serializza gli array JS come array Postgres, quindi il parametro non veniva mai legato. Il filtro per socio per puro caso evitava il path rotto. Ora la query usa ovunque `inArray()` di Drizzle, che espande in un classico `IN (?, ?, ...)` con un placeholder per elemento.
- **L'xlsx del fornitore è ora alfabetico in tutti i fogli, ognuno con la sua chiave di sort.** La matrice `Distinta` e `Totali per prodotto` seguivano il campo `sortOrder` di ogni prodotto, che poteva essere impostato arbitrariamente e raramente corrispondeva all'ordine atteso dai fornitori. I tre fogli read-only sono ora ordinati come ognuno viene effettivamente letto: `Distinta` e `Totali per prodotto` per nome prodotto poi varietà, `Riepilogo Ordini Soci` (rinominato, prima era "Riepilogo ordini") per socio poi prodotto poi varietà, così tutto quello che un singolo socio ha ordinato sta in un unico blocco. Stesso workbook ovunque venga scaricato — hub 🤝 Fornitore, allegato della mail o Admin → Ordini.
- **Righe d'ordine più chiare nel modale "Vedi ordini".** Le righe apparivano come `1 1 × €2,00 = €2,00` perché il vecchio campo "Unità" era salvato come la stringa letterale `"1"` su molti prodotti e finiva accodato alla quantità. La `"1"` ora viene trattata come "nessuna unità" in tutto il modale (anche nella vista rettifica), quindi si legge `1 × €2,00 = €2,00`. Quando il prodotto ha un prezzo al kg di riferimento, viene mostrato sotto al prezzo unitario (es. `€5,00/kg`).

---

## [1.5.0] — 17 maggio 2026

### Aggiunte
- **Modifica ordine di un socio anche a ciclo chiuso.** Dentro al modale "Recap ordini" ogni socio ha un pulsante ✎ Modifica che apre lo stesso stepper del form ordine: si possono cambiare quantità, aggiungere prodotti del catalogo del ciclo, rimuovere righe, o creare un ordine da zero per un socio che non aveva ordinato (pulsante "+ Aggiungi ordine per un socio" in fondo al modale). Pensato per il classico caso "ah, dimenticato di mettere le uova nella sua borsa".
- **Voci di correzione nel saldo.** Le modifiche non toccano mai l'addebito originale: la differenza fra il totale vecchio e il totale nuovo viene scritta come voce `correction` separata (negativa = addebito aggiuntivo, positiva = rimborso). Lo storico resta tracciabile e ogni modifica è reversibile pubblicando una correzione opposta.
- **Notifica al socio in automatico.** Il socio riceve una notifica `order_corrected` con il dettaglio del cambiamento e il nuovo saldo, con link diretto al ciclo dentro `/storico`.

---

## [1.4.5] — 17 maggio 2026

### Risolto
- **I pulsanti del ciclo aperto in admin non escono più dalla card su mobile**. La fila "Gestisci Prodotti / Modifica / Chiudi con rettifiche / Chiudi ciclo" prima sforava sui telefoni e l'ultimo ("Chiudi ciclo") veniva tagliato. Sotto i 640px ora i pulsanti vanno a capo sotto il titolo del ciclo e si dispongono su più righe se serve; su tablet/desktop il layout resta uguale a prima.

---

## [1.4.4] — 17 maggio 2026

### Risolto
- **Rimosso il suffisso "/1" residuo accanto ai prezzi dei prodotti** ovunque: riepilogo ordini in home, form ordine, storico, catalogo admin, viste cicli. Veniva fuori dal vecchio campo "Unità" (per molti prodotti compilato letteralmente con "1") che la v1.4.3 aveva tolto dal form ma continuava a stampare nei dettagli prodotto come `/1`. Ora i prezzi sono `€2,00` (o `€2,00 (€4,00/kg)` quando è impostato il prezzo al chilo), senza barra finale.

---

## [1.4.3] — 17 maggio 2026

### Aggiunte
- **Prezzo al chilo di riferimento** su ogni prodotto (opzionale). L'admin lo può compilare per i prodotti a peso (es. €5,00 il cestino, €15,00/kg) e il socio vede entrambi i prezzi nel form ordine. Mostrato ovunque appaia il prezzo: catalogo, ordine, scheda fornitore.
- **Tooltip di aiuto** accanto a ogni campo del form prodotto. Passa il mouse (o tocca) il "?" vicino al titolo del campo per leggere un esempio breve che spiega cosa mettere.

### Modificato
- **Form prodotto semplificato**: rimosso il campo "Unità" (duplicava il formato e confondeva). Ora i campi sono Nome · Varietà · Formato · Categoria · Prezzo · Prezzo/kg (opzionale) · Note · Icona.
- **Categoria è ora un menu a tendina**: lista predefinita (Frutta, Verdura, Pane e cereali, Pasta e riso, Latticini, Uova, Carne, Pesce, Conserve, Olio e aceto, Bevande, Dolci, Altro) unita alle categorie già usate dal fornitore, con un'opzione "+ aggiungi nuova categoria" in fondo per casi al volo.
- **Template CSV aggiornato** al nuovo schema colonne `Nome; Varietà; Formato; Prezzo; Prezzo/kg; Categoria; Icona; Note`. L'import continua ad accettare anche il vecchio formato con "Unità" per retrocompatibilità.

---

## [1.4.2] — 17 maggio 2026

### Aggiunte
- **Selettore emoji con ricerca** nel campo "Icona" dei prodotti. Cliccando sull'icona si apre un menù con circa 80 emoji legate al cibo: basta scrivere "pomodoro", "miele", "carciofo" per filtrare. Niente più digitazione manuale dell'emoji.

### Modificato
- **Saldi soci allineati al foglio CASSA** in vista del lancio ufficiale. Tutte le vecchie voci ledger (dati di test) sono state cancellate e sostituite con una voce iniziale di tipo `adjustment` per ciascun socio, con il saldo finale del foglio "FRUTTA E VERDURA 2025-2026 → CASSA". I soci non presenti nel foglio partono da zero.

---

## [1.4.1] — 14 maggio 2026

### Aggiunte
- **Pagina "Cosa è cambiato"** dentro l'app all'indirizzo `/changelog`. Linkata in fondo alla pagina Guida. Ha un selettore IT/EN, così la pagina stessa è bilingue.
- **Sezione "Novità" nella Guida** che mostra un'anteprima dell'ultima release (le prime due sezioni, massimo quattro voci per sezione) con un link al changelog completo.

### Modificato
- L'export CSV per il fornitore ora è dettagliato per socio: una riga per ogni combinazione (fornitore × prodotto × socio). Ordinato per fornitore → prodotto → socio così il fornitore può preparare la borsa di ogni socio direttamente dal file.
- Rimosse le righe di subtotale dal CSV per il fornitore — ora ogni riga è una vera riga d'ordine, così il fornitore non rischia di contare due volte un prodotto sommando le righe per socio e poi il subtotale.

---

## [1.4.0] — 14 maggio 2026

### Aggiunte
- **Dashboard statistiche admin** — nuova tab "Stats" nel pannello admin con:
  - Top 10 prodotti più ordinati (barre orizzontali)
  - Trend del fatturato negli ultimi 12 cicli chiusi (grafico a linea + area, con percentuale di variazione rispetto al ciclo precedente)
  - Classifica fornitori per fatturato, con il prodotto più richiesto per ciascun fornitore
  - Partecipazione dei soci divisa in tre fasce: attivi / occasionali / dormienti
  - Quattro card di sintesi in alto: cicli chiusi, soci attivi, fatturato totale, prodotto top
- **Card "Insights" sulla home admin** — tre metriche a colpo d'occhio sopra la lista cicli:
  - "In scadenza" (cicli che chiudono entro 24h)
  - "Saldo < 0" (soci con saldo negativo)
  - "Top 30gg" (prodotto più venduto negli ultimi 30 giorni)
  - Ogni card è cliccabile e ti porta direttamente alla tab admin corrispondente
- **Export CSV per il fornitore** — bottone "⬇ CSV fornitore" nel modale "Recap ordini". Scarica un file CSV compatibile con Excel italiano (UTF-8 con BOM, punto-e-virgola come separatore, virgola decimale)
- **README in inglese** — descrizione del progetto pronta per essere mostrata pubblicamente sul repo GitHub, con note di architettura

---

## [1.3.0] — 10 maggio 2026

### Aggiunte
- **Bottone "Riproponi ultimo ordine"** nel form ordine — un click precarica il carrello con l'ultimo ordine del socio, abbinando i prodotti per nome/varietà. Visibile solo quando il carrello è vuoto, così non si rischia mai di sovrascrivere modifiche in corso
- **Card "Prossimo ritiro"** sulla home, tra il saldo e i cicli. Mostra giorno, orario, fornitore e un contatore "tra X giorni" (visibile se mancano 14 giorni o meno)

### Performance
- Aggiunti indici DB mancanti su `products.cycle_id` e `ledger_entries.cycle_id` — colonne usate ad ogni caricamento della home admin e del form ordine

---

## [1.2.0] — 10 maggio 2026

### Aggiunte
- **Spedizione proporzionale all'ordine** — alla chiusura del ciclo, l'admin sceglie tra spedizione fissa per socio (come prima) o proporzionale al valore di ogni ordine. In modalità proporzionale il totale spedizione viene diviso con arrotondamento a 2 decimali; il centesimo eventualmente residuo finisce sull'ordine più grande così la somma resta esatta
- **Chiusura ciclo con rettifica prezzi** — nuovo flusso per i prodotti a peso (es. 1 kg di insalata pesato 1,2 kg). Apre un modale dove l'admin modifica il prezzo unitario finale dei prodotti che servono; il sistema ricalcola ogni riga d'ordine e gli addebiti sul ledger prima di confermare
- **SETUP.md** — guida passo-passo per configurare l'ambiente di sviluppo in locale

### Risolto
- `drizzle-kit push` ora legge correttamente `.env.local` tramite il flag `--env-file` di Node — prima caricava solo `.env` e falliva silenziosamente con `url: ''`

---

## [1.1.0] — 10 maggio 2026

### Risolto
- **Race condition sulla chiusura ciclo (critico)** — `adminCloseCycle` ora usa un compare-and-swap atomico (`UPDATE ... WHERE status='open' RETURNING`) invece di un check + update separati. Due admin che cliccano "Chiudi" contemporaneamente non possono più produrre doppi addebiti. Se gli insert sul ledger falliscono a metà flusso, lo stato del ciclo viene riportato indietro così l'admin può riprovare in modo pulito
- **Errore silenzioso quando il ciclo viene chiuso durante un ordine** — se un admin chiude il ciclo mentre un socio sta compilando il form, ora il form viene rinfrescato subito con un messaggio chiaro, invece di fallire senza feedback
- **Saldo negativo ora rosso anche nel tab Movimenti** dello storico, coerente con la home
- **La notifica di chiusura ciclo** ora menziona la spedizione nel testo e linka direttamente al ciclo specifico nello storico (`/storico?cycleId=...`)
- **Il logo in alto** è ora cliccabile (torna alla home)
- **La barra di navigazione in fondo** rispetta la safe area dell'iPhone (non viene coperta dalla home indicator)
- **Sezione "categoria vuota" nel form ordine**: i prodotti senza categoria sono ora raggruppati sotto "Altro" se ci sono altre categorie definite, invece di apparire in una sezione senza titolo

---

## [1.0.0] — 5 maggio 2026

### Aggiunte
- Prima release in produzione della riscrittura in Next.js 15 (migrazione Apps Script → Next.js)
- Funzionalità per i soci: card saldo, form ordine con stepper per ogni prodotto, storico ordini e movimenti, notifiche in-app, guida con FAQ
- Pannello admin con 6 tab: cicli, prodotti, ordini, cassa, soci, fornitori
- Login con Google tramite Auth.js, con whitelist email sulla tabella `members`
- Database Neon Postgres + Drizzle ORM
- Deploy automatico su Vercel da `main`

---

[Non rilasciato]: https://github.com/federicodecillia/porta_moneta/compare/v1.6.0...HEAD
[1.6.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.6.0
[1.5.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.5.0
[1.4.5]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.5
[1.4.4]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.4
[1.4.3]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.3
[1.4.2]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.2
[1.4.1]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.1
[1.4.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.0
[1.3.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.3.0
[1.2.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.2.0
[1.1.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.1.0
[1.0.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.0.0
