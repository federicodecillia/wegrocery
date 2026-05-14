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

### Modificato
- L'export CSV per il fornitore ora è dettagliato per socio: una riga per ogni combinazione (fornitore × prodotto × socio). Ordinato per fornitore → prodotto → socio così il fornitore può preparare la borsa di ogni socio direttamente dal file.

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

[Non rilasciato]: https://github.com/federicodecillia/porta_moneta/compare/v1.4.0...HEAD
[1.4.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.4.0
[1.3.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.3.0
[1.2.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.2.0
[1.1.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.1.0
[1.0.0]: https://github.com/federicodecillia/porta_moneta/releases/tag/v1.0.0
