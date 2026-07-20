# Cosa è cambiato

Tutte le modifiche importanti all'app WeGrocery sono elencate qui.

Il formato segue [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
e il versionamento è basato su [Semantic Versioning](https://semver.org/spec/v2.0.0.html):

- **Major** — modifiche grosse che richiedono ai soci di reimparare qualcosa
- **Minor** — funzionalità nuove, nessuna rottura
- **Patch** — correzioni di bug, piccoli miglioramenti UI, documentazione

Come si scrivono le voci: una tagline in corsivo sotto il titolo di versione,
poi un punto per ogni modifica coerente — un'emoji a tema, un **titolo in
grassetto** e al massimo due righe su cosa vede l'utente. I dettagli tecnici
stanno nella PR.

> 🇬🇧 The English version of this file is [CHANGELOG.md](./CHANGELOG.md).
> Le due versioni devono restare sincronizzate.

---

## [1.8.0] — 20 luglio 2026

*Confermare un ordine ora si vede, e puoi ripensarci fino alla chiusura del ciclo.*

### Aggiunte
- ✅ **Confermare un ordine apre una conferma vera.** Un riquadro riepiloga cosa è stato inviato e fino a quando puoi cambiarlo, al posto del messaggino che spariva dopo un secondo.
- 📋 **Al rientro trovi il tuo ordine confermato.** La pagina ordine si apre sul riepilogo di quello che hai in archivio — prodotti, quantità, totale, saldo dopo — invece di riportarti nella lista prodotti.
- ✏️ **Modifica o cancella quando vuoi, fino alla chiusura del ciclo.** Entrambe le azioni stanno sotto il riepilogo; la cancellazione chiede conferma e rimuove l'ordine, così alla chiusura non ti viene addebitato nulla.

### Modificato
- 📰 **Il changelog si legge come delle note di rilascio, non come un rapporto.** Punti brevi con emoji a tema, una riga di sintesi per ogni versione e categorie a colpo d'occhio.
- 🔔 **Il promemoria di chiusura può arrivare fino a ~3 ore prima** (prima erano esattamente 2). Il job schedulato non gira a intervalli perfettamente regolari, e la finestra più larga evita che salti un ciclo.
- 🤝 **Scegliere un fornitore è obbligatorio all'apertura del ciclo**, così un ciclo non può più chiudersi senza.
- 🔤 **Niente testo sotto i 10px.** 55 micro-etichette nelle viste admin e socio sono state alzate. Verificato a 375px: nessuno sbordo.

### Risolto
- 🤝 **Il fornitore ora si può impostare o correggere su un ciclo chiuso.** Il campo spariva alla chiusura, lasciando bloccato per sempre un ciclo creato senza.
- 🔒 **Un ordine confermato nell'istante in cui l'admin chiude il ciclo non può più passare senza addebito.** Il salvataggio blocca il ciclo nella stessa transazione: o la chiusura aspetta il salvataggio, o il salvataggio viene rifiutato in modo pulito.
- 🛡️ **Gli account disattivati non possono più agire con una sessione ancora aperta.** Ordini e azioni admin ricontrollano il flag attivo a ogni richiesta, e le quantità sono validate prima di scrivere.
- 🌍 **Il riquadro "Novità" nella Guida segue la lingua dell'app.** Sui deploy inglesi mostrava il teaser italiano.
- 🎨 **La pagina 404 è tradotta e usa i colori del gruppo.** Entrambe le pagine di errore avevano colori fissi, proprio sulle pagine che saltano il layout tematizzato.
- 🗣️ **Le ultime stringhe italiane sui deploy inglesi** — la notifica di rettifica ordine e l'avviso di saldo negativo — ora seguono la lingua dell'app.

---

## [1.7.0] — 10 luglio 2026

*Preferenze notifiche con canale email, e import guidato del listino del fornitore.*

### Aggiunte
- 🔔 **Preferenze notifiche per socio, con l'email come canale opzionale.** Campanella → ⚙ permette a ognuno di scegliere app e/o email per categoria. Arrivano due eventi nuovi: apertura del ciclo e promemoria prima della chiusura per chi non ha ancora ordinato.
- 📥 **Import guidato del listino fornitore.** Una procedura in tre passi legge l'`.xlsx` o il `.csv` del fornitore, riconosce la riga di intestazione e il fornitore, ti fa mappare quello che non ha capito e mostra un'anteprima riga per riga prima di scrivere.
- 📦 **Stato "Catalogo in preparazione" nel form ordine**, così un ciclo aperto senza prodotti non sembra più rotto.
- 🔒 **Limite di 10 MB sugli upload admin**, controllato prima ancora di decodificare il file, più una protezione contro le bombe di decompressione sui `.ods`.
- 🗄️ **Indici unici su righe d'ordine e prodotti per ciclo**, così import concorrenti non possono infilare duplicati oltre i controlli applicativi (migrazione `0008`).
- 🧪 **Test sulle funzioni pure che toccano i soldi** — riparto spedizione, parser del changelog, euristiche di intestazione, lettura numeri da foglio. Suite a 78 test.

### Modificato
- 📅 **Ritiri più facili da inserire.** Il secondo ritiro è opzionale dietro un interruttore, e gli orari si scelgono da un menu a slot di 15 minuti: le 19:30 sono sempre selezionabili invece di essere rifiutate come non valide.
- 📤 **La distinta compilata si può caricare anche in `.ods` o `.csv`.** Con il `.csv`, che non può portare la mappatura nascosta, i nomi vengono abbinati e tutto ciò che è ambiguo viene segnalato e saltato, mai indovinato.
- ✏️ **Le due strade di rettifica nel recap ordini ora sono distinte** — ✎ Prodotti per le quantità, una ✎ su ogni riga per peso o prezzo effettivo — con un suggerimento che funziona anche su telefono, dove non c'è il passaggio del mouse.
- 🖥️ **Riga "Carica prodotti" più ordinata** in Admin → Prodotti: il menu del fornitore di destinazione ha una riga sua ed etichettata, e le tre azioni restano leggibili su mobile.

### Risolto
- 🍆 **Emoji suggerite sbagliate** per melanzana, riso e peperoni — sovrapposizioni nella tabella "vince il primo che combacia", ora fissate da test di regressione.
- 🛒 **Il salvataggio dell'ordine è atomico.** Cancellazione e inserimento erano due richieste separate: un'interruzione nel mezzo poteva lasciare l'ordine vuoto senza dirlo.
- 🌍 **I file caricati corrotti mostrano un errore tradotto** invece del messaggio inglese della libreria, e le ultime tre stringhe italiane fisse nell'admin seguono la lingua.
- 📱 **I pulsanti del ciclo aperto non escono più dallo schermo**, e le righe data/ora dei ritiri vanno a capo sui telefoni stretti. Verificato fino a 320px.

---

## [1.6.0] — 21 maggio 2026

*Distinte fornitore che fanno andata e ritorno, rettifiche riga per riga e statistiche vere.*

### Aggiunte
- 🔄 **Una distinta fornitore che torna indietro.** 📧 Fornitore invia un `.xlsx` fatto come i fornitori già lavorano — prodotti in riga, soci in colonna, totali automatici — e 📤 Carica distinta rilegge il file restituito, mostra l'anteprima delle differenze e applica sia le correzioni di riga sia la spedizione per socio.
- ⚖️ **Registra cosa è stato consegnato davvero, riga per riga.** Tocca una riga d'ordine per inserire quantità e costo reali (ordinato 1 kg, ricevuti 800 g): la differenza diventa una correzione e il socio viene avvisato.
- 📊 **Filtri in Admin → Statistiche** per ciclo, fornitore o socio, combinabili, con azzeramento in un clic.
- ✏️ **Modifica un ciclo dopo la chiusura** — titolo, note, date di ritiro, spedizione — senza riaprirlo.
- 🚚 **La spedizione si ricalcola da sola sui cicli chiusi**, e ogni socio coinvolto riceve una notifica con la quota vecchia e nuova.
- 📧 **Invia l'ordine al fornitore via email**, con l'admin che agisce e l'archivio GAS condiviso in CC e un CSV per prodotto allegato.
- 🧾 **La spedizione è visibile nel recap ordini**, così i totali a schermo coincidono con quello che è stato addebitato ai soci.
- 💾 **Backup settimanale del database su Google Drive**, a complemento delle 7 ore di storico point-in-time di Neon.

### Modificato
- 🤝 **Tutte le azioni fornitore in un unico riquadro 🤝 Fornitore** — scarica, invia, carica — e da qui circola un solo file ufficiale invece di formati divergenti.
- 💰 **Admin → Cassa si apre con tre schede riassuntive**, inclusa una "Saldo < 0" cliccabile che prima era sepolta in Admin → Ciclo.
- 📈 **Le schede di Admin → Ciclo sono diventate una linea del tempo**: Aperti / In scadenza (≤7 giorni) / Chiusi (ultimi 7 giorni).
- 📊 **I filtri delle statistiche sono a selezione multipla** con casella di ricerca, e una vista filtrata resta condivisibile via link.
- 📄 **Il template prodotti è un file Excel** con un esempio già compilato per ogni categoria comune; l'import accetta ancora il `.csv`.
- 🧾 **I totali in Admin → Ordini includono rettifiche e spedizione**, così la riga di ogni socio corrisponde a quanto gli è stato addebitato.
- 📱 **"Ultimi cicli" più pulito su mobile** — la pillola di stato è passata a sinistra così si legge come etichetta, e le azioni vanno a capo sotto.
- 🏷️ **"Fatturato" rinominato "Spesa"** in tutte le statistiche, e ora comprende anche la spedizione.
- 📋 **Un solo formato riga `qta × prezzo = totale`** nel recap, con le righe rettificate che mostrano ordinato ed effettivo.

### Risolto
- 📊 **Le statistiche andavano in errore filtrando per ciclo o fornitore.** Il driver HTTP di Neon non converte gli array JS in array Postgres, quindi il filtro non si legava mai; ora la query usa `inArray()` ovunque.
- 🔤 **Le distinte fornitore sono in ordine alfabetico e senza distinzione tra maiuscole e minuscole**, ogni foglio ordinato con la chiave che rispecchia come viene letto.
- 📋 **Le righe d'ordine non si leggono più `1 1 × €2,00`.** Il vecchio campo "Unità" salvato come stringa "1" ora è trattato come "nessuna unità".

---

## [1.5.0] — 17 maggio 2026

*Sistemare l'ordine di un socio dopo la chiusura del ciclo.*

### Aggiunte
- ✏️ **Modifica l'ordine di un socio dopo la chiusura** — cambia quantità, aggiungi prodotti o crea da zero un ordine per chi non aveva partecipato. Pensata per il caso "mi sono dimenticato di metterti le uova".
- 🧾 **Le correzioni non toccano l'addebito originale.** La differenza viene registrata come voce `correction` separata, così la tracciabilità resta intatta e ogni modifica è reversibile.
- 🔔 **Il socio riceve una notifica** con la differenza leggibile e il nuovo saldo.

---

## [1.4.5] — 17 maggio 2026

*Una correzione mobile.*

### Risolto
- 📱 **I pulsanti del ciclo aperto non sbordano più sui telefoni.** Sotto i 640px si dispongono sotto al titolo invece di far sparire l'ultima azione.

---

## [1.4.4] — 17 maggio 2026

*Una correzione estetica.*

### Risolto
- 🏷️ **Tolto il "/1" appeso ai prezzi** ovunque. Veniva da un vecchio campo "Unità" nascosto dal form ma ancora stampato a schermo.

---

## [1.4.3] — 17 maggio 2026

*Un form prodotto più semplice e più spiegato.*

### Aggiunte
- ⚖️ **Prezzo al kg di riferimento** su ogni prodotto (opzionale), mostrato ai soci accanto al prezzo unitario ovunque compaia un prezzo.
- ❓ **Aiuto in linea su ogni campo del form prodotto**, una riga e un esempio ciascuno.

### Modificato
- 📝 **Il form prodotto ha perso il campo "Unità".** Duplicava il formato e confondeva gli admin.
- 🗂️ **La categoria ora è un menu a tendina** — categorie predefinite unite a quelle già usate dal fornitore, più un "aggiungi nuova" in linea.
- 📄 **Il template CSV segue il nuovo ordine di colonne**; l'import accetta ancora il vecchio.

---

## [1.4.2] — 17 maggio 2026

*Scegli un'emoji, e parti dai saldi veri.*

### Aggiunte
- 😀 **Un selettore di emoji con ricerca** per l'icona del prodotto, filtrabile con parole italiane, al posto del campo di testo libero.

### Modificato
- 💰 **Saldi dei soci allineati al vecchio foglio CASSA** prima di andare in produzione, una voce iniziale per socio.

---

## [1.4.1] — 14 maggio 2026

*Il changelog entra nell'app.*

### Aggiunte
- 📰 **Una pagina "Cosa è cambiato" su `/changelog`**, collegata dalla Guida, con il suo selettore IT/EN.
- 👀 **Un'anteprima dell'ultima versione dentro la Guida**, con il link alla pagina completa.

### Modificato
- 📄 **Il CSV fornitore è dettagliato per socio** e ordinato fornitore → prodotto → socio, così si può usare direttamente per preparare le borse.
- 🧮 **Tolte le righe di subtotale dal CSV fornitore**, così non si può contare due volte sommando entrambe.

---

## [1.4.0] — 14 maggio 2026

*Numeri per l'admin.*

### Aggiunte
- 📊 **Una dashboard di statistiche** nel pannello admin: prodotti più ordinati, andamento della spesa sugli ultimi 12 cicli chiusi, classifica fornitori, partecipazione dei soci e quattro schede di sintesi.
- 📈 **Schede di sintesi sulla home admin** per i cicli in scadenza, i saldi negativi e il più venduto degli ultimi 30 giorni, ognuna collegata al tab giusto.
- 📄 **Esportazione CSV fornitore** dal riquadro del ciclo chiuso, nel formato che Excel italiano si aspetta.
- 📚 **Un README in inglese** con le note di architettura.

---

## [1.3.0] — 10 maggio 2026

*Riproponi l'ultimo ordine con un tocco.*

### Aggiunte
- 🔁 **"Riproponi ultimo ordine"** riempie il carrello partendo dal tuo ordine più recente, abbinando i prodotti per identità. Compare solo a carrello vuoto, così non può sovrascrivere il lavoro in corso.
- 📅 **Una scheda "Prossimo ritiro"** in home con giorno, fascia oraria, fornitore e conteggio dei giorni mancanti.

### Performance
- ⚡ **Indici su `products.cycle_id` e `ledger_entries.cycle_id`**, interrogati a ogni caricamento delle pagine admin e ordine.

---

## [1.2.0] — 10 maggio 2026

*Riparto della spedizione e rettifiche a peso.*

### Aggiunte
- 🚚 **Riparto proporzionale della spedizione** come alternativa alla quota fissa per socio, con lo scarto di arrotondamento assorbito in modo deterministico perché il totale resti esatto al centesimo.
- ⚖️ **Chiudi un ciclo con rettifiche di prezzo** per i prodotti a peso: modifichi ogni prezzo finale e il sistema ricalcola tutte le righe e le voci di cassa prima di addebitare.
- 📚 **SETUP.md**, la guida passo passo allo sviluppo locale con le insidie di `vercel env pull`.

### Risolto
- 🗄️ **`drizzle-kit push` legge `.env.local`** tramite `--env-file` di Node. Prima caricava solo `.env` e falliva in silenzio con url vuoto.

---

## [1.1.0] — 10 maggio 2026

*Irrobustita la chiusura del ciclo.*

### Risolto
- 🔒 **Race condition sulla chiusura del ciclo (critica).** La chiusura ora è un confronta-e-scambia atomico: due admin che cliccano insieme non possono più generare addebiti doppi.
- 🛒 **Chiudere un ciclo mentre qualcuno ordina dà un riscontro.** Il form ordine si aggiorna con un messaggio invece di fallire in silenzio.
- 🧾 **I saldi negativi sono rossi nel tab Movimenti**, come in home.
- 🔔 **La notifica di chiusura ciclo cita la spedizione** e porta direttamente a quel ciclo nello storico.
- 🖼️ **Il logo in alto riporta alla home.**
- 📱 **La barra in basso rispetta l'area sicura del tasto home dell'iPhone.**
- 🗂️ **I prodotti senza categoria finiscono sotto "Altro"** invece di formare una sezione senza titolo.

---

## [1.0.0] — 5 maggio 2026

*Primo rilascio in produzione della riscrittura Next.js.*

### Aggiunte
- 🚀 **La riscrittura in Next.js 15 va in produzione**, portando il gruppo fuori da Apps Script.
- 🛒 **L'app per i soci**: saldo, form ordine con contatori per prodotto, storico ordini e movimenti, notifiche in app, guida con le domande frequenti.
- 🛠️ **Il pannello admin** con sei tab — cicli, prodotti, ordini, cassa, soci, fornitori.
- 🔒 **Login Google via Auth.js**, con lista di email autorizzate sulla tabella soci.
- 🗄️ **Neon Postgres e Drizzle ORM**, in produzione su Vercel con deploy automatico da `main`.

---

[1.8.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.0
[1.7.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.7.0
