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

## [Non rilasciato]

## [1.22.0] — 4 ottobre 2026

*Una persona, un account: i doppioni ora si possono unire.*

### Aggiunte
- 🔗 **Unire due account dello stesso socio.** In Admin → Soci, "Unisci" porta un account doppione dentro quello che resta: ruolo ed email principale restano, l'altro indirizzo diventa la secondaria, e ordini aperti, notifiche e saldo passano. Lo stesso viene proposto se nel modulo di modifica si scrive l'indirizzo di un altro socio. Migrazione `0027_member_merge.sql`.

### Risolto
- 🗑️ **Si può di nuovo eliminare un socio che non ha mai ordinato.** In Admin → Soci l'eliminazione falliva con un errore del database se l'account aveva ricevuto una notifica (quasi tutti i nuovi ricevono quella del ciclo aperto); ora l'account si elimina insieme alle sue notifiche.

## [1.21.1] — 4 ottobre 2026

*Note che i soci possono leggere, e un elenco soci che sta in un telefono.*

### Risolto
- 📝 **Le note arrivano ai soci.** Le note che l'admin scrive su un ciclo ora compaiono in Home e in cima alla pagina Ordine, quelle di ogni prodotto sotto il nome nel modulo d'ordine e nel riepilogo. Prima le vedevano solo gli admin.
- 📱 **Elenco soci leggibile da telefono.** In Admin → Soci gli indirizzi email non finiscono più sotto i pulsanti: l'elenco mostra nome, ultimo accesso e azioni, gli indirizzi sono nel modulo di modifica, e sugli schermi stretti i pulsanti stanno sotto il nome.

## [1.21.0] — 3 ottobre 2026

*Entrare con il codice dell'email, e l'app sulla schermata Home del telefono.*

### Aggiunte
- 🔢 **Entra anche con un codice.** L'email di accesso ora contiene anche un codice di 6 cifre: scrivilo nella pagina di accesso quando il link si apre nel browser sbagliato o su un altro dispositivo. Vale 15 minuti come il link, tre tentativi per codice.
- 📱 **Installa l'app sul telefono.** Da telefono la Home propone di aggiungere l'app alla schermata Home (il pulsante Installa su Android, i passaggi su iPhone), con icone ricavate dal logo del tuo gruppo; la Guida lo spiega.

### Risolto
- 🧩 **La descrizione dell'app torna raggiungibile.** Stava dietro l'accesso: un browser che la chiedeva senza sessione (sempre, dalla pagina di accesso) riceveva la pagina di login, quindi l'app non si installava bene.

## [1.20.0] — 1 ottobre 2026

*Notifiche che dicono cosa coprono, una Cassa che dà un nome a ogni movimento e Next.js 16 sotto il cofano.*

### Modificato
- 🔔 **Preferenze di notifica più chiare.** I quattro gruppi dicono cosa coprono: nuovo ciclo aperto, addebiti e pagamenti (compresi il conguaglio e le conferme dei pagamenti online), modifiche all'ordine (compreso un ciclo annullato) e saldo e rimborsi. Le tue scelte salvate restano; le conferme di pagamento ora seguono "Addebiti e pagamenti".

- 🧰 **Next.js 16 e TypeScript 7.** Stessa app, fondamenta più nuove; a chi la installa da sé serve Node.js 20.19 o successivo, e il lint si lancia con `npm run lint`.
- 🌙 **Controllo notturno più solido.** Il controllo dei conti non aspetta più il backup, e una notte fallita o bloccata apre una issue su GitHub.

### Risolto
- 🏷️ **Cassa dà un nome a ogni movimento.** I vecchi rimborsi e pagamenti con carta, le spedizioni e le rettifiche mostravano nel badge un codice tecnico come `ORDER_REFUND`; ora si leggono "rimborso carta", "pagamento ordine", "spedizione" e così via, e un tipo sconosciuto mostra un semplice "movimento".
- ✏️ **Modificare un ciclo dopo la chiusura.** Salvare titolo o ritiro di un ciclo da un modulo aperto prima della chiusura non fallisce più con "le spese non si possono più cambiare" quando le spese non sono state toccate.
- 👥 **I dettagli del ciclo chiuso elencano ogni socio addebitato.** Un socio con spedizione o spese di preparazione ma senza più righe d'ordine ora compare nell'elenco, così i soci mostrati tornano con il totale.
- 💬 **Messaggio sul credito più chiaro.** La scheda dei saldi dice ora che la differenza pagata è un tuo credito; in inglese due messaggi dell'admin indicano anche il tetto delle spese in euro.

## [1.19.0] — 1 ottobre 2026

*Installarla per il proprio gruppo in mezz'ora, e spese di preparazione che diventano un addebito vero e controllato.*

### Aggiunto
- 🚀 **Installala per il tuo gruppo.** Una guida passo passo (`docs/self-hosting.md`, in inglese) con il pulsante Deploy to Vercel, che crea il progetto e il suo database Neon e applica tutte le migrazioni al primo build; `docs/brand.example.json` elenca tutti i campi del brand.
- 👑 **Primo admin di un'installazione nuova.** L'indirizzo in `BOOTSTRAP_ADMIN_EMAIL` diventa admin al primo accesso, solo finché il gruppo non ha un admin; lo Stato della configurazione dice quando togliere la variabile.
- 🧾 **Spese di preparazione ordine.** Un ciclo può addebitare una quota per commissioni bancarie e spese di gestione, in entrambe le modalità di pagamento: una percentuale dei prodotti o un importo fisso per socio, fino al 25% o a 10 €. I soci la vedono prima di ordinare; si addebita alla chiusura come movimento a sé e viene controllata ogni notte. Nota di aggiornamento: applica `drizzle/0026_handling_charge.sql` subito prima del deploy se `MIGRATE_ON_BUILD` è spento.

### Modificato
- 💳 **Pagamento per ordine: la quota è un costo, non una stima.** Resta all'associazione; il conguaglio regola solo prodotti e spedizione. Con la spedizione proporzionale ogni socio paga la sua parte al conguaglio.
- 🩹 **Le installazioni nuove non si rompono più nella home.** Tre colonne dei cicli mancavano nelle migrazioni; una migrazione in più le aggiunge (non fa nulla sulle installazioni esistenti). Un test in CI confronta tutto lo schema con un database vuoto migrato. Nota di aggiornamento: applica `drizzle/0025_schema_catch_up.sql`.
- 🧭 **Lo Stato della configurazione trova gli errori del brand.** Un campo che l'app non conosce (un errore di battitura) o un brand che non si legge compaiono, con il motivo, in Impostazioni e in `npm run doctor`.
- 🏗️ **Migrazioni al build solo in produzione.** Con `MIGRATE_ON_BUILD=true` i build di anteprima non migrano più: lo fanno solo quelli di produzione (e quelli fuori da Vercel).

## [1.18.0] — 1 ottobre 2026

*Pagare ogni ordine con la carta, chiudere i conti a fine ciclo, e un registro che non riscrive mai la storia.*

### Aggiunto
- 💳 **Pagamento per ordine, selezionabile.** Gli admin possono passare il gruppo al pagamento di ogni ordine con la carta da Impostazioni, quando nessun ciclo è in corso; la card elenca cosa impedisce il cambio e i saldi prima di confermare. Nota di aggiornamento: applicare `drizzle/0024_settlement.sql` prima del deploy; il pagamento per ordine richiede l'euro e una chiave Stripe valida.
- 🧮 **Chiudi i conti.** Su un ciclo pagato per ordine, chiuso o annullato, "Chiudi i conti" rimborsa sulla carta quello che ogni socio ha pagato oltre i costi definitivi, chiede quanto manca e abbuona le differenze sotto 0,50 €. Il ciclo mostra a che punto è: da conguagliare, rimborsi in corso, conti chiusi, da aggiornare, rimborso non riuscito.
- 🔴 **Da saldare e credito.** Se i costi hanno superato quanto pagato, Home e la pagina dei saldi mostrano "Da saldare" con "Paga ora"; i nuovi pagamenti d'ordine aspettano che sia saldato. Un credito compare come denaro che l'associazione restituisce.
- 🧾 **Paga fuori app.** Nel pagamento per ordine un admin può segnare chi paga in contanti: conferma gli ordini senza carta, il tesoriere registra i soldi e il conguaglio lo esclude.
- 📚 **Storico e guida del pagamento per ordine.** Ogni ciclo nello Storico mostra pagato, costi, rimborsi e netto; guida e FAQ spiegano la quota, il conguaglio e i tempi dei rimborsi.

### Modificato
- 🧾 **Le correzioni non riscrivono la storia.** Modificare o eliminare un movimento in Cassa, ricalcolare la spedizione di un ciclo chiuso o importare la distinta del fornitore ora annullano il movimento con uno storno e, se serve, aggiungono quello corretto; i soci vedono un solo movimento con "corretto il". Nota di aggiornamento: applicare `drizzle/0023_ledger_append_only.sql` subito prima del deploy (il database rifiuta da quel momento le modifiche ai movimenti passati).

## [1.17.0] — 30 settembre 2026

*Accesso con un link via email, e le basi per pagare ogni ordine.*

### Aggiunte
- ✉️ **Accesso con un link via email.** Scrivi il tuo indirizzo e ricevi un link che ti fa entrare, senza bisogno di un account Google; Google resta per chi lo preferisce. Gli admin possono mandare il link come invito da Soci e vedono l'ultimo accesso di ogni socio. Nota di aggiornamento: applicare `drizzle/0022_auth_sessions.sql` prima del deploy; l'invio email (Resend) deve essere configurato; dopo l'aggiornamento tutti rientrano una volta; l'indirizzo di ritorno di Google non cambia.
- 🧮 **Controllo notturno dei conti.** Dopo il backup, un controllo in sola lettura verifica che pagamenti, rimborsi e addebiti tornino, e segnala subito se non tornano.
- 🧭 **Stato della configurazione.** In Impostazioni si vede cosa è collegato in questa installazione (database, accesso, email, pagamenti...) e cosa manca, solo per nome; `npm run doctor` stampa lo stesso. Le note di aggiornamento per versione stanno in `docs/upgrading.md`, e `MIGRATE_ON_BUILD=true` applica le migrazioni a ogni build di produzione (facoltativo).
- 💳 **Pagamento per ordine, le basi.** L'app ora sa incassare il pagamento di un ordine con Stripe, rimborsarlo se l'ordine viene annullato o se il pagamento arriva a ordini chiusi, e riprovare un rimborso dalla Cassa. Non ancora selezionabile: diventa un'opzione in Impostazioni insieme al conguaglio. Nota di aggiornamento: applicare `drizzle/0021_pay_per_order.sql` prima del deploy; nessuna variabile nuova, nessun evento Stripe nuovo.

### Modificato
- 🔕 **Niente email predefinita all'apertura del ciclo.** Chi non ha scelto riceve l'avviso "ciclo aperto" solo nell'app e può accendere l'email nelle preferenze; chi aveva già scelto mantiene la sua scelta.

## [1.16.1] — 30 settembre 2026

*Un layout da computer, e le basi per tenere d'occhio la salute dell'app.*

### Aggiunte
- 🩺 **Controllo di stato e segnalazione degli errori facoltativa.** `/api/health` dice se l'app e il suo database rispondono, e gli errori del server possono arrivare a Sentry. Nota di aggiornamento: nessuna migrazione; `SENTRY_DSN` è facoltativa, senza non cambia nulla.

### Modificato
- 🖥️ **Un vero layout da computer.** Da computer il menu passa in alto e le pagine tengono una larghezza comoda da leggere; solo Admin usa la finestra larga, e in Cassa i form stanno accanto ai saldi dei soci.
- 🔤 **Testi di lettura un po' più grandi.** Descrizioni ed elenchi nelle pagine dei soci passano da 13 a 14 px.
- ✉️ **La tua email, senza ingombro.** Da telefono non occupa più una riga sotto il logo: la trovi nella pagina Notifiche.

## [1.16.0] — 30 settembre 2026

*Testi che si leggono, con i colori di qualsiasi gruppo.*

### Modificato
- 👓 **Testi che si leggono.** Pulsanti, link, etichette e importi hanno ora abbastanza contrasto in ogni schermata: testo scuro sui pulsanti colorati, tonalità più scure per i testi colorati e grigi, un rosso più profondo per gli importi negativi.
- 🎨 **Colori che seguono la palette del gruppo.** I colori dei testi si calcolano dai colori del brand, così un gruppo con un'altra palette resta leggibile. Nota di aggiornamento: nessuna azione richiesta; i colori del tema devono essere esadecimali (`#rgb` o `#rrggbb`), altrimenti si usa la palette di default con un avviso `[brand]` nei log.
- 🔎 **Niente sotto i 12 px.** Etichette, badge e didascalie che erano a 10 o 11 px sono ora a 12 px, e da telefono i campi dei form non ingrandiscono più la pagina quando li tocchi.

### Risolto
- 💶 **Saldo su una riga.** In Home il saldo non va più a capo dopo il segno nei formati inglesi.

## [1.15.0] — 30 settembre 2026

*Rimborsi sulla carta che puoi seguire.*

### Aggiunte
- ⚠️ **Rimborsi non andati a buon fine.** Se un rimborso sulla carta fallisce dopo l'invio, l'importo torna sul saldo, lo Storico mostra "Rimborso non riuscito", e il socio e gli admin vengono avvisati di come verrà restituito.

### Modificato
- 💳 **Rimborsi sulla carta registrati uno per uno.** Ogni rimborso di una ricarica online viene registrato una volta sola, appena Stripe lo accetta, anche quando arriva in più passaggi (migrazione `0020`).

## [1.14.1] — 30 settembre 2026

*Importi più ordinati nelle Impostazioni.*

### Risolto
- ⚙️ **Saldo massimo con i centesimi.** Le Impostazioni mostrano un importo salvato come 35,20 € con entrambe le cifre dei centesimi, non più 35,2.

## [1.14.0] — 29 settembre 2026

*Le impostazioni dei pagamenti in app, e l'ordine che ti aspetta.*

### Aggiunte
- ⚙️ **Impostazioni dei pagamenti per gli admin.** Una nuova tab Impostazioni (icona a ingranaggio) fissa lo scoperto massimo del gruppo, un saldo massimo e i canali di ricarica che vedono i soci: bonifico (intestatario e IBAN) e pagamento online. Finché un admin non salva non cambia nulla (migrazione `0019`).
- 🛒 **L'ordine ti aspetta.** Le modifiche all'ordine si salvano mentre le fai: esci dalla pagina e rientra, anche da un altro dispositivo, e le ritrovi, segnate come "Modifiche non ancora confermate" finché non le confermi o le annulli.
- 🧾 **Dettaglio dei movimenti.** Tocca un movimento nello Storico per vedere data e ora, ciclo, nota, metodo e riferimento, lo stato del pagamento online e chi l'ha registrato.

### Modificato
- 💶 **Le ricariche rispettano il saldo massimo.** La ricarica online propone solo quanto ci sta, il bonifico dice quanto puoi ancora ricaricare, e chi ha un debito trova come prima scelta l'importo esatto per saldarlo.
- 🏦 **La Cassa segnala i saldi sopra il massimo.** Una ricarica registrata in Cassa non viene mai rifiutata, ma l'admin viene avvisato se porta il saldo oltre il massimo, e un nuovo filtro elenca quei soci.

## [1.13.0] — 29 settembre 2026

*Una Cassa più completa, e uno storico che torna con il saldo.*

### Aggiunte
- 💸 **Movimenti in uscita in Cassa.** Gli admin possono registrare la restituzione del saldo a un socio (mai oltre il saldo), un addebito manuale o la quota associativa, ognuno con una causale che il socio legge nella notifica.
- 🏦 **Ricarica manuale con metodo e riferimento.** Si cerca il socio per nome o email, si sceglie il metodo (bonifico, contanti, Satispay, altro) e si indica il CRO/TRN: un riferimento già usato viene rifiutato, una ricarica simile negli ultimi giorni chiede conferma, e prima di salvare c'è un riepilogo (migrazione `0018`).
- 🧺 **Scelta del ciclo quando ce n'è più di uno aperto.** "Ordine" elenca i cicli aperti con il fornitore invece di aprire il primo, e il pulsante del countdown in home apre il suo ciclo.

### Modificato
- 📒 **Lo storico torna con il saldo.** Ogni ciclo mostra prodotti (dopo le pesate), spedizione, correzioni e il totale addebitato sul saldo, e ogni movimento ha un nome chiaro e la sua icona: Ricarica, Spedizione, Rimborso, Rettifica, Restituzione saldo, Quota associativa.
- ➕ **Importi con il segno.** Saldo e movimenti mostrano sempre + o -, e in home un saldo negativo si legge "Da ricaricare".
- 🚚 **La spedizione segue le modifiche agli ordini chiusi.** Modificare l'ordine di un socio dopo la chiusura ridivide la spedizione di tutti sui totali effettivi (dopo le pesate), tranne quando arriva dalla distinta del fornitore; riceve una notifica solo chi vede cambiare la propria quota.
- 🔐 **Un socio disattivato esce subito.** Disattivare un socio, admin compresi, chiude la sua sessione alla richiesta successiva invece che alla scadenza.

### Risolto
- 📧 **Email e alias non si ripetono più tra soci.** Salvare un socio con un'email o un'email secondaria già usata da un altro, anche con maiuscole diverse, viene rifiutato indicando chi la usa (migrazione `0017`).
- ⚠️ **Messaggi d'errore leggibili.** In produzione i rifiuti previsti (ciclo chiuso, campo mancante, ordine cambiato nel frattempo) mostrano il loro testo invece di un errore generico, e la pagina dell'ordine si ricarica da sola se il ciclo si è chiuso.

## [1.12.2] — 29 settembre 2026

*Ricariche online più piccole.*

### Modificato
- 💶 **Ricariche online da 0,50 €**, l'importo minimo accettato da Stripe (prima 20 €).

## [1.12.1] — 28 settembre 2026

*Dati per la ricarica più chiari.*

### Modificato
- 🏦 **IBAN a gruppi di quattro** nella pagina Ricarica, più facile da ricontrollare a occhio; il pulsante Copia lo copia comunque senza spazi.
- 📖 **Guida e FAQ rimandano alla pagina Ricarica** per il bonifico e il pagamento online.

## [1.12.0] — 28 settembre 2026

*Ricarica il saldo online.*

### Aggiunte
- 💳 **Ricarica online.** Una nuova pagina "Ricarica" (dalla card del saldo in home) permette di ricaricare con carta o con gli altri metodi attivati dal gruppo, tramite una pagina di pagamento Stripe. Il saldo si aggiorna da solo appena il pagamento è confermato, e i rimborsi fatti da Stripe compaiono nello storico.
- 🏦 **Dati per il bonifico nella stessa pagina.** Se il gruppo li imposta, la pagina mostra anche intestatario, IBAN e causale per il bonifico, ognuno con il pulsante per copiarlo.

### Modificato
- 🔒 **I pagamenti online restano legati a Stripe.** In Cassa le ricariche e i rimborsi arrivati da un pagamento online non si possono più modificare o eliminare: i soldi si sono mossi su Stripe, quindi si corregge con un rimborso lì o con una rettifica separata.

## [1.11.0] — 28 settembre 2026

*Aperta a tutti i soci con tessera attiva, con flussi di denaro più sicuri.*

### Aggiunte
- 🪪 **I soci con tessera attiva possono entrare da soli.** Al primo accesso con Google, con la stessa email della tessera, l'app la verifica e crea l'account, senza che un admin debba abilitarlo. La tessera viene ricontrollata prima che un ordine aumenti, e la pagina di login spiega cosa fare se l'accesso viene negato.
- 💳 **Limite di credito.** Un ordine che porterebbe il saldo (contando gli ordini ancora aperti su altri cicli) sotto il limite del gruppo viene rifiutato, indicando l'importo ancora disponibile; ridurre o cancellare un ordine funziona sempre.
- 🔐 **Link all'informativa privacy** nella pagina di login e nel footer.

### Modificato
- 👥 **Ruoli e accesso ai cicli usano gli stessi tre nomi: Admin, Attivi, Utenti.** Gli admin vedono tutti i cicli, gli Attivi i cicli standard e quelli privati, gli Utenti solo quelli standard. La scheda socio non propone più Admin per un ruolo non riconosciuto, e "membri abilitati" indica ora l'interruttore che abilita un account.

### Risolto
- 🕰️ **Gli orari seguono Roma ovunque.** Chiusura e ritiro non si spostano più di due ore tra card, moduli ed email, un ciclo smette di accettare ordini all'ora che mostra, e il passaggio all'ora solare del 25 ottobre è gestito.
- 🧾 **Modificare un movimento in Cassa ne conserva il segno.** Cambiare solo la nota di un rimborso non lo trasforma più in un addebito, e un importo vuoto viene rifiutato invece di corrompere il saldo. Addebiti ordine e spedizione si correggono con un nuovo movimento, non modificandoli.
- ⚖️ **Modificare un ordine chiuso conserva le quantità pesate**, così una nuova pesata non può più rimborsare due volte un socio.
- 🚚 **Salvare un ciclo chiuso conserva la spedizione importata dalla distinta**, invece di azzerare la quota di tutti e inviare notifiche sbagliate.
- 🔒 **La chiusura di un ciclo è tutto-o-niente.** Addebiti, spedizione e cambio di stato vengono scritti insieme, e il database rifiuta un secondo addebito per lo stesso ciclo.

### Sicurezza
- ⚡ **Next.js aggiornato alla 15.5.25**, che corregge due vulnerabilità critiche di esecuzione di codice da remoto. Una richiede un server ospitato su Windows (noi giriamo su Vercel/Linux); l'altra riguardava l'ottimizzazione delle immagini, già limitata al solo host del logo del brand. Anche `sharp` è passato alla 0.35.4.
- 📤 **Un file fornitore malevolo non poteva più bloccare un'importazione distinta.** Ri-importare un file `.ods` (es. da un salvataggio con LibreOffice) usava un parser XML con un bug di denial-of-service su lunghe sequenze di spazi, ora corretto.
- 📊 **Una vulnerabilità dormiente nella libreria dei fogli di calcolo, corretta comunque.** `exceljs` include una versione vecchia e vulnerabile di `uuid`; non sfruttabile qui perché l'unico punto in cui viene usata non tocca il percorso vulnerabile, ma fissata comunque alla versione corretta.
- 🧹 **Una dipendenza di sviluppo** (`js-yaml`) con una vulnerabilità di denial-of-service aggiornata. Non ha mai raggiunto gli utenti.

---

## [1.10.3] — 6 settembre 2026

*Stesso prodotto, stesso scaffale.*

### Correzioni
- 🥕 **Un prodotto non si spezza più tra categorie diverse.** "Cicoria" (o qualsiasi altro prodotto) finisce sempre nella stessa categoria, qualunque sia la varietà o il lotto d'importazione da cui arriva — il riconoscimento dal nome vince sulla colonna categoria del fornitore, incoerente da un file all'altro, ovunque i prodotti vengano caricati in un ordine.
- 🔤 **I prodotti sono finalmente ordinati per davvero.** La schermata dell'ordine (e ogni altro elenco prodotti) è in ordine alfabetico per prodotto, poi varietà, poi formato e prezzo, invece di seguire l'ordine casuale dell'ultima importazione.

---

## [1.10.2] — 30 agosto 2026

*Meno verdure perse dentro "Altro".*

### Correzioni
- 🥬 **I prodotti finiscono più spesso nella categoria giusta.** Un file fornitore che etichetta quasi tutto come "Altro"/"Varie" non sovrascrive più un riconoscimento sicuro — una zucchina, una melanzana, una patata finiscono ora in Verdura anche se il foglio del fornitore non si è preso la briga di specificarlo.
- 🌿 **Più prodotti ottengono un'icona automatica.** Basilico, prezzemolo e altre erbe aromatiche — anche in nomi composti come "Basilico viola da trapiantare" — ottengono ora un'icona coerente invece del carrello generico. Vengono riconosciuti anche i plurali (zucchine, carote, funghi, asparagi...) e alcuni prodotti prima senza icona (pancetta, gamberi, calamari, mandarino, olive) ora ne hanno una.

---

## [1.10.1] — 27 agosto 2026

*Fare in modo che la casella del fornitore la veda davvero.*

### Correzioni
- 📬 **L'email dell'ordine al fornitore finisce meno spesso nello spam.** Le risposte arrivano ora direttamente all'admin che l'ha inviata, l'oggetto parte dal nome della tua cooperativa invece che dall'app, e il messaggio viene inviato in HTML oltre che in testo semplice — tre segnali che i filtri antispam usano per fidarsi di un messaggio.

---

## [1.10.0] — 27 agosto 2026

*Una via d'uscita quando un ciclo va storto dopo che è già stato chiuso.*

### Aggiunte
- 🚫 **Annulla un ciclo chiuso e rimborsa tutti.** Quando un fornitore non consegna un ordine già addebitato, un admin può ora annullare quel ciclo: ogni socio addebitato viene riaccreditato per intero (prodotti, e spedizione a meno che tu non la escluda), con un motivo obbligatorio e una traccia completa — un badge "annullato" sul ciclo, un movimento segnalato nello storico di ogni socio, una riga di audit log e una notifica a ogni socio rimborsato.

---

## [1.9.0] — 7 agosto 2026

*Una notifica in meno, e un ingranaggio in meno dietro le quinte.*

### Rimosse
- 🔕 **Il promemoria "il ciclo sta per chiudere" non c'è più.** Arrivava nelle notifiche quando un ciclo stava per chiudere e non avevi ancora ordinato; la notifica di apertura ciclo dice già la data di chiusura, quindi era in gran parte la stessa informazione ripetuta.
- ⚙️ **Il suo interruttore è sparito dalle impostazioni notifiche.** Una riga in meno da leggere; i promemoria ricevuti in passato restano nell'elenco delle notifiche.

---

## [1.8.1] — 28 luglio 2026

*Aggiornamenti di sicurezza per il login e per la gestione delle immagini.*

### Sicurezza
- 🔒 **Auth.js aggiornato alla versione che corregge quattro vulnerabilità**, due delle quali critiche (`next-auth` 5.0.0-beta.32, `@auth/core` 0.41.3). Nessuna era sfruttabile qui — l'app non ha login via link email, non chiama mai `getToken()`, ha un solo provider OAuth senza collegamento di account, e ogni controllo di accesso legge `session.user.email` invece della semplice esistenza dell'oggetto di sessione — ma la correzione è un aggiornamento minimo, quindi non c'era motivo di rimandare.
- 🖼️ **L'endpoint delle immagini non accetta più qualsiasi indirizzo su internet.** Prima consentiva `https://**`, che in un'installazione self-hosted trasforma `/_next/image` in un proxy aperto: chiunque poteva far scaricare al server immagini arbitrarie e darle in pasto alla libreria di elaborazione. Ora è ammesso esattamente l'indirizzo del logo del gruppo, preso dalla configurazione del deploy stesso.
- ⚡ **Next.js aggiornato alla 15.5.22** per una correzione su un blocco del servizio nell'ottimizzazione delle immagini, e la libreria di elaborazione forzata a una versione con `libvips` corretto (`sharp` 0.35.3), che a monte non è ancora stata adottata.
- 🧹 **Due dipendenze di solo sviluppo** con vulnerabilità di blocco del servizio (`js-yaml`, `brace-expansion`) aggiornate. Non sono mai arrivate agli utenti.

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

[1.22.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.22.0
[1.21.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.21.1
[1.21.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.21.0
[1.20.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.20.0
[1.19.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.19.0
[1.18.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.18.0
[1.17.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.17.0
[1.16.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.16.1
[1.16.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.16.0
[1.15.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.15.0
[1.14.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.14.1
[1.14.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.14.0
[1.13.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.13.0
[1.12.2]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.2
[1.12.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.1
[1.12.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.12.0
[1.11.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.11.0
[1.9.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.9.0
[1.8.1]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.1
[1.8.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.8.0
[1.7.0]: https://github.com/federicodecillia/wegrocery/releases/tag/v1.7.0
