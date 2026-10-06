// Italian member guide. Plain language for members, valid for any group:
// nothing here may name a specific group, supplier or place (those belong in
// the deploy's settings). Keep en.ts in step: same slugs, topics, conditions
// and number of steps (lib/guide/guide.test.ts checks it).

import type { GuideContent } from "./types";

export const guideIt: GuideContent = {
  topics: [
    { id: "primi-passi", emoji: "👋", title: "Primi passi", summary: "Entrare, installare l'app sul telefono, orientarsi." },
    { id: "ordinare", emoji: "🧺", title: "Ordinare", summary: "Fare, modificare e annullare un ordine, cosa succede alla chiusura." },
    { id: "soldi", emoji: "💶", title: "Saldo e pagamenti", summary: "Come si paga, ricariche, rimborsi e movimenti." },
    { id: "famiglia", emoji: "🏠", title: "Famiglia", summary: "Fare la spesa insieme con un carrello e un saldo in comune." },
    { id: "notifiche", emoji: "🔔", title: "Notifiche", summary: "Gli avvisi dell'app e come riceverli anche via email." },
    { id: "account", emoji: "👤", title: "Accesso e profilo", summary: "Problemi di accesso, nome ed email, uscire dall'app." },
  ],
  articles: [
    // Primi passi
    {
      slug: "come-entrare",
      topic: "primi-passi",
      title: "Come entro nell'app",
      steps: [
        "Nella pagina di accesso scrivi la tua email e tocca **Mandami il link**.",
        "Apri l'email che ti arriva: tocca il link e poi **Entra**.",
        "In alternativa scrivi nella pagina di accesso il codice di 6 cifre che trovi nella stessa email.",
      ],
      notes: [
        "Link e codice valgono 15 minuti e una sola volta. Se l'email non arriva, guarda nello spam.",
        "Una volta dentro resti collegato su quel telefono o computer finché non esci.",
      ],
      keywords: ["login", "accedere", "password", "codice", "link", "registrarsi"],
    },
    {
      slug: "installare-app",
      topic: "primi-passi",
      title: "Installare l'app sul telefono",
      intro: "Puoi aggiungere l'app alla schermata Home: si apre come le altre app, senza la barra del browser.",
      steps: [
        "Su iPhone apri l'app con Safari, tocca Condividi (il quadrato con la freccia in su) e poi **Aggiungi alla schermata Home**.",
        "Su Android apri l'app con Chrome e tocca **Installa**, oppure dal menu ⋮ scegli **Aggiungi a schermata Home**.",
        "La prima volta che entri dall'app installata usa il codice di 6 cifre che arriva via email insieme al link.",
      ],
      notes: ["Dal telefono trovi le stesse istruzioni anche nel tuo **Profilo**, alla voce **Installa l'app sul telefono**."],
      keywords: ["telefono", "cellulare", "iphone", "android", "icona", "schermata home", "scaricare"],
    },
    {
      slug: "com-e-fatta",
      topic: "primi-passi",
      title: "Com'è fatta l'app",
      steps: [
        "**Home**: il tuo saldo, l'ordine aperto con il tempo che resta e gli ultimi movimenti.",
        "**Ordine**: il catalogo del ciclo aperto, dove scegli i prodotti e confermi.",
        "**Storico**: i tuoi ordini passati e tutti i movimenti del saldo.",
        "**Guida**: questa pagina, con le novità dell'app e i contatti.",
      ],
      notes: [
        "In alto trovi la campanella delle notifiche e il cerchio con le tue iniziali: apre il tuo **Profilo**, con le tue impostazioni. La voce **Admin** la vede solo chi gestisce il gruppo.",
      ],
      keywords: ["menu", "schermate", "tab", "orientarsi"],
    },

    // Ordinare
    {
      slug: "fare-ordine",
      topic: "ordinare",
      title: "Fare un ordine",
      steps: [
        "In Home controlla che ci sia un ordine aperto e fino a quando resta aperto.",
        "Tocca **Ordine** e scegli i prodotti con i pulsanti + e −. In basso vedi il totale e il saldo dopo l'ordine.",
        "Tocca **Conferma ordine**. L'ordine resta modificabile finché il ciclo è aperto.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["ordinare", "comprare", "spesa", "carrello", "prodotti"],
      when: { mode: "wallet" },
    },
    {
      slug: "fare-ordine-carta",
      topic: "ordinare",
      title: "Fare un ordine",
      steps: [
        "In Home controlla che ci sia un ordine aperto e fino a quando resta aperto.",
        "Tocca **Ordine** e scegli i prodotti con i pulsanti + e −. Sotto il totale vedi prodotti, spedizione e spese di preparazione.",
        "Tocca **Conferma e paga** e completa il pagamento con la carta. L'ordine è confermato appena il pagamento va a buon fine.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["ordinare", "comprare", "spesa", "carrello", "prodotti", "pagare"],
      when: { mode: "per_order" },
    },
    {
      slug: "riproponi-ordine",
      topic: "ordinare",
      title: "Rifare l'ordine della volta scorsa",
      steps: [
        "In **Ordine** tocca **Riproponi ultimo ordine**.",
        "I prodotti del tuo ultimo ordine ancora disponibili tornano nel carrello.",
        "Cambia quello che vuoi e conferma.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["ripetere", "uguale", "stesso ordine", "riordinare"],
    },
    {
      slug: "modificare-ordine",
      topic: "ordinare",
      title: "Modificare o cancellare l'ordine",
      intro: "Puoi farlo finché il ciclo è aperto.",
      steps: [
        "Apri **Ordine**: vedi il tuo ordine confermato.",
        "Tocca **Modifica ordine**, cambia le quantità e conferma di nuovo.",
        "Per toglierlo del tutto tocca **Cancella ordine**: alla chiusura non ti viene addebitato nulla.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["cambiare", "annullare", "eliminare", "togliere", "correggere"],
      when: { mode: "wallet" },
    },
    {
      slug: "modificare-ordine-carta",
      topic: "ordinare",
      title: "Modificare o annullare l'ordine",
      intro: "Puoi farlo finché il ciclo è aperto.",
      steps: [
        "Apri **Ordine** e cambia le quantità.",
        "Se il totale sale paghi solo la differenza; se scende, la differenza ti torna sulla carta a conti chiusi.",
        "Per toglierlo del tutto tocca **Annulla ordine**: il rimborso parte subito e arriva sulla carta di solito in 5-10 giorni.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["cambiare", "cancellare", "eliminare", "togliere", "correggere", "rimborso"],
      when: { mode: "per_order" },
    },
    {
      slug: "modifiche-salvate",
      topic: "ordinare",
      title: "Ho lasciato l'ordine a metà",
      intro: "Le scelte nel carrello si salvano da sole mentre le fai: quando torni le ritrovi.",
      steps: [
        "Apri **Ordine**: in alto vedi **Modifiche non ancora confermate**.",
        "Conferma l'ordine per inviarle, oppure tocca **Annulla modifiche** per tornare all'ordine confermato.",
      ],
      notes: [
        "Finché non confermi, le modifiche non fanno parte dell'ordine. Se il ciclo chiude prima, si perdono.",
      ],
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["bozza", "salvato", "perso", "carrello", "non confermato"],
    },
    {
      slug: "quando-ordinare",
      topic: "ordinare",
      title: "Fino a quando posso ordinare",
      intro:
        "La Home mostra quando chiude l'ordine e quanto tempo resta. Dopo la chiusura l'ordine non si può più cambiare: il gruppo lo manda ai fornitori.",
      notes: [
        "Se ci sono più ordini aperti insieme, in **Ordine** scegli prima quale aprire.",
        "I giorni di ritiro sono indicati in Home, sotto l'ordine.",
      ],
      keywords: ["scadenza", "chiusura", "orario", "ritiro", "consegna", "data"],
    },
    {
      slug: "dopo-chiusura",
      topic: "ordinare",
      title: "Cosa succede quando l'ordine chiude",
      steps: [
        "Il costo del tuo ordine viene scalato dal saldo: i prodotti, la tua parte di spedizione se c'è e, se il ciclo le prevede, le spese di preparazione.",
        "Ricevi una notifica con l'importo addebitato.",
        "Nei giorni di ritiro indicati in Home passi a prendere la spesa.",
      ],
      keywords: ["addebito", "chiusura", "spedizione", "ritiro"],
      when: { mode: "wallet" },
    },
    {
      slug: "dopo-chiusura-carta",
      topic: "ordinare",
      title: "Cosa succede quando l'ordine chiude",
      steps: [
        "Il gruppo manda l'ordine ai fornitori. Nei giorni di ritiro indicati in Home passi a prendere la spesa.",
        "Dopo il ritiro, con i costi definitivi, si chiudono i conti del ciclo: quello che hai pagato in più ti torna sulla carta.",
        "Se i costi hanno superato quanto hai pagato, in Home trovi **Da saldare**.",
      ],
      keywords: ["chiusura", "conti chiusi", "spedizione", "ritiro", "rimborso"],
      when: { mode: "per_order" },
    },
    {
      slug: "correzioni",
      topic: "ordinare",
      title: "Mi hanno consegnato una quantità diversa",
      intro:
        "Capita con i prodotti a peso: hai ordinato 1 kg e ne arrivano 800 g. Chi gestisce il gruppo registra la quantità vera e la differenza viene sistemata.",
      notes: [
        "La vedi nello **Storico** come rettifica o correzione, e ricevi una notifica.",
      ],
      link: { href: "/storico", label: "Apri Storico" },
      keywords: ["peso", "pesata", "grammi", "kg", "prezzo diverso", "rettifica", "differenza"],
    },

    // Saldo e pagamenti
    {
      slug: "come-funziona-saldo",
      topic: "soldi",
      title: "Come funziona il saldo",
      intro:
        "Il saldo è il tuo credito presso il gruppo. Lo ricarichi in anticipo e, alla chiusura di ogni ordine, il costo viene scalato da lì.",
      notes: [
        "In Home vedi il saldo di oggi e quanto resterà dopo l'ordine aperto.",
      ],
      keywords: ["credito", "conto", "soldi", "borsellino"],
      when: { mode: "wallet" },
    },
    {
      slug: "ricarica-bonifico",
      topic: "soldi",
      title: "Ricaricare con un bonifico",
      steps: [
        "In Home tocca **Ricarica il saldo**.",
        "Nella sezione **Bonifico** copia intestatario, IBAN e causale.",
        "Fai il bonifico dalla tua banca.",
      ],
      notes: [
        "Il saldo si aggiorna quando chi gestisce la cassa registra il bonifico: ti arriva una notifica.",
      ],
      link: { href: "/ricarica", label: "Apri Ricarica" },
      keywords: ["versamento", "iban", "banca", "soldi", "credito"],
      when: { mode: "wallet", bankTransfer: true },
    },
    {
      slug: "ricarica-online",
      topic: "soldi",
      title: "Ricaricare online con la carta",
      steps: [
        "In Home tocca **Ricarica il saldo**.",
        "In **Paga online** scegli un importo o scrivilo.",
        "Tocca **Paga** e completa il pagamento. Il saldo si aggiorna appena il pagamento è confermato.",
      ],
      notes: [
        "L'importo minimo è 0,50 €. Se il gruppo ha fissato un saldo massimo, la ricarica online si ferma lì.",
      ],
      link: { href: "/ricarica", label: "Apri Ricarica" },
      keywords: ["carta", "credito", "bancomat", "pagare", "online", "soldi"],
      when: { mode: "wallet", onlineTopup: true },
    },
    {
      slug: "ricarica-cassa",
      topic: "soldi",
      title: "Ricaricare il saldo",
      intro: "Chiedi a chi gestisce la cassa come versare: quando registra il versamento il saldo si aggiorna e ti arriva una notifica.",
      keywords: ["versamento", "bonifico", "contanti", "soldi", "credito"],
      when: { mode: "wallet", bankTransfer: false, onlineTopup: false },
    },
    {
      slug: "saldo-negativo",
      topic: "soldi",
      title: "Posso ordinare con il saldo basso o negativo?",
      intro:
        "Sì, per non impedirti di fare la spesa: l'app ti avvisa quando vai in negativo. Se il gruppo ha fissato un limite, oltre quel limite l'ordine non si salva finché non ricarichi.",
      notes: [
        "Il limite conta anche gli ordini già confermati e non ancora addebitati. Ricarica appena puoi: il gruppo paga i fornitori con quei soldi.",
      ],
      link: { href: "/ricarica", label: "Apri Ricarica" },
      keywords: ["negativo", "debito", "insufficiente", "rosso", "limite"],
      when: { mode: "wallet" },
    },
    {
      slug: "spese-preparazione",
      topic: "soldi",
      title: "Cosa sono le spese di preparazione ordine",
      intro:
        "Se il ciclo le prevede, sono una piccola quota per le commissioni bancarie e le spese di gestione del gruppo: una percentuale dei prodotti o un importo fisso. Le vedi nel riepilogo dell'ordine e vengono addebitate alla chiusura insieme all'ordine.",
      keywords: ["commissioni", "costi", "quota", "fee", "gestione"],
      when: { mode: "wallet" },
    },
    {
      slug: "come-si-paga",
      topic: "soldi",
      title: "Come si paga l'ordine",
      intro:
        "Con la carta, quando confermi l'ordine. Paghi prodotti, spedizione e spese di preparazione. Se poi modifichi l'ordine e il totale sale, paghi solo la differenza.",
      link: { href: "/ordine", label: "Apri Ordine" },
      keywords: ["carta", "pagare", "bancomat", "online"],
      when: { mode: "per_order" },
    },
    {
      slug: "spese-preparazione-carta",
      topic: "soldi",
      title: "Cosa sono le spese di preparazione ordine",
      intro:
        "Una quota per le commissioni bancarie e le spese di gestione del gruppo, decisa per ogni ciclo: una percentuale dei prodotti o un importo fisso. La vedi prima di confermare e resta al gruppo.",
      keywords: ["commissioni", "costi", "quota", "fee", "gestione"],
      when: { mode: "per_order" },
    },
    {
      slug: "rimborsi",
      topic: "soldi",
      title: "Quando arrivano i rimborsi",
      intro:
        "Dopo la chiusura dei conti del ciclo, sulla carta con cui hai pagato: di solito in 5-10 giorni. Se annulli l'ordine mentre il ciclo è aperto, il rimborso parte subito.",
      keywords: ["rimborso", "restituzione", "soldi indietro", "carta"],
      when: { mode: "per_order" },
    },
    {
      slug: "da-saldare",
      topic: "soldi",
      title: "Cos'è \"Da saldare\"",
      intro:
        "Se i costi definitivi di un ciclo superano quanto hai pagato, la differenza compare in Home come **Da saldare**. La paghi con **Paga ora**.",
      notes: [
        "Finché resta qualcosa da saldare non puoi pagare nuovi ordini, ma puoi modificare o annullare quelli già fatti.",
      ],
      link: { href: "/ricarica", label: "Apri i tuoi saldi" },
      keywords: ["debito", "pagare", "differenza", "conguaglio"],
      when: { mode: "per_order" },
    },
    {
      slug: "credito",
      topic: "soldi",
      title: "Vedo un credito: cosa devo fare?",
      intro: "Niente: sono soldi che il gruppo ti deve, e te li restituisce chi gestisce la cassa.",
      keywords: ["credito", "avanzo", "soldi", "restituzione"],
      when: { mode: "per_order" },
    },
    {
      slug: "movimenti",
      topic: "soldi",
      title: "Dove vedo tutti i movimenti",
      steps: [
        "Apri **Storico** e scegli **Movimenti**.",
        "Trovi ricariche, addebiti, rimborsi e correzioni, dal più recente.",
        "Tocca un movimento per vedere data, ciclo e dettagli.",
      ],
      link: { href: "/storico", label: "Apri Storico" },
      keywords: ["storico", "estratto conto", "addebiti", "ricariche", "lista"],
    },

    // Famiglia
    {
      slug: "cos-e-famiglia",
      topic: "famiglia",
      title: "Cos'è la famiglia",
      intro:
        "Chi fa la spesa insieme può condividere un solo carrello, un solo saldo e lo storico degli ordini. Ognuno continua a entrare con la sua email e riceve le sue notifiche.",
      notes: ["Una famiglia può avere al massimo 6 persone."],
      link: { href: "/famiglia", label: "Apri Famiglia" },
      keywords: ["condividere", "insieme", "marito", "moglie", "partner", "coinquilino", "casa"],
      when: { families: true },
    },
    {
      slug: "invitare-famiglia",
      topic: "famiglia",
      title: "Invitare qualcuno in famiglia",
      steps: [
        "Apri il tuo **Profilo** (il cerchio con le iniziali in alto) e tocca **Famiglia**.",
        "In **Invita qualcuno** scrivi l'email con cui l'altra persona entra nell'app e tocca **Invia invito**.",
        "L'altra persona riceve una notifica e un'email, e ha 7 giorni per accettare.",
      ],
      notes: ["Chi inviti deve essere già entrato nell'app almeno una volta."],
      link: { href: "/famiglia", label: "Apri Famiglia" },
      keywords: ["invito", "aggiungere", "condividere"],
      when: { families: true },
    },
    {
      slug: "accettare-famiglia",
      topic: "famiglia",
      title: "Accettare un invito",
      steps: [
        "Apri il tuo **Profilo** (il cerchio con le iniziali in alto) e tocca **Famiglia**.",
        "In **Inviti ricevuti** tocca **Accetta**.",
        "Da quel momento carrello, saldo e storico sono in comune. Il tuo saldo passa alla famiglia.",
      ],
      notes: [
        "Se tu e la famiglia avete già un ordine sullo stesso ciclo aperto, annullane uno prima di accettare.",
      ],
      link: { href: "/famiglia", label: "Apri Famiglia" },
      keywords: ["invito", "unirsi", "entrare"],
      when: { families: true },
    },
    {
      slug: "uscire-famiglia",
      topic: "famiglia",
      title: "Uscire dalla famiglia",
      intro:
        "Nel tuo **Profilo** apri **Famiglia** e tocca **Esci dalla famiglia**. Torni al tuo account con saldo zero: saldo, ordini e storico restano alla famiglia.",
      notes: ["Chi ha creato la famiglia può togliere una persona con **Rimuovi**."],
      link: { href: "/famiglia", label: "Apri Famiglia" },
      keywords: ["lasciare", "rimuovere", "separare", "togliere"],
      when: { families: true },
    },

    // Notifiche
    {
      slug: "leggere-notifiche",
      topic: "notifiche",
      title: "Leggere le notifiche",
      intro:
        "Il pallino rosso sulla campanella in alto dice quante notifiche non hai ancora letto. Toccala per vederle; **Segna tutte ✓** le segna come lette.",
      notes: [
        "Ti avvisiamo per esempio quando si apre un ordine, quando viene addebitato, quando arriva una ricarica e quando il tuo ordine viene corretto.",
      ],
      link: { href: "/notifiche", label: "Apri Notifiche" },
      keywords: ["campanella", "avvisi", "pallino", "messaggi"],
    },
    {
      slug: "preferenze-notifiche",
      topic: "notifiche",
      title: "Ricevere le notifiche anche via email",
      steps: [
        "Apri il tuo **Profilo** (il cerchio con le iniziali in alto) e tocca **Preferenze notifiche**.",
        "Ci arrivi anche dalla campanella, con l'ingranaggio in alto a destra.",
        "Per ogni gruppo di notifiche scegli se riceverle nell'app, via email o in tutti e due i modi.",
      ],
      notes: ["All'inizio le notifiche arrivano solo nell'app."],
      link: { href: "/profilo/notifiche", label: "Apri Preferenze notifiche" },
      keywords: ["email", "posta", "avvisi", "disattivare", "preferenze", "impostazioni"],
    },

    // Accesso e account
    {
      slug: "link-non-funziona",
      topic: "account",
      title: "Il link o il codice non funziona",
      steps: [
        "Link e codice valgono 15 minuti e una sola volta: se è passato più tempo, chiedine uno nuovo.",
        "Vale solo l'ultimo codice ricevuto: usa quello dell'email più recente.",
        "Se hai l'app installata sul telefono, usa il codice invece del link.",
      ],
      notes: [
        "Se l'app dice che la tua email non è tra i soci, prova con l'indirizzo con cui ti sei iscritto al gruppo. Se non basta, scrivi ai contatti in fondo a questa pagina.",
      ],
      keywords: ["accesso", "login", "scaduto", "errore", "non entro", "negato"],
    },
    {
      slug: "cambiare-email",
      topic: "account",
      title: "Ho cambiato email o ho due account",
      intro:
        "Scrivi a chi gestisce il gruppo: può cambiare il tuo indirizzo, o unire i due account con saldo e ordini.",
      notes: ["Le email con cui puoi entrare sono nel tuo **Profilo**. Nel frattempo entra con l'indirizzo che funziona."],
      link: { href: "/profilo", label: "Apri Profilo" },
      keywords: ["indirizzo", "doppio", "unire", "nuova email", "account"],
    },
    {
      slug: "quale-email",
      topic: "account",
      title: "Con quale email sono entrato?",
      intro:
        "Tocca il cerchio con le tue iniziali in alto: il **Profilo** mostra il tuo nome, l'email con cui sei entrato e le altre con cui puoi entrare.",
      link: { href: "/profilo", label: "Apri Profilo" },
      keywords: ["indirizzo", "account", "chi sono", "profilo"],
    },
    {
      slug: "cambiare-nome",
      topic: "account",
      title: "Cambiare il nome",
      steps: [
        "Apri il tuo **Profilo** (il cerchio con le iniziali in alto).",
        "Alla voce **Nome** tocca **Modifica**, scrivi il nome e salva.",
      ],
      notes: ["È il nome con cui ti vede chi gestisce il gruppo."],
      link: { href: "/profilo", label: "Apri Profilo" },
      keywords: ["nome", "cognome", "profilo", "modificare"],
    },
    {
      slug: "uscire",
      topic: "account",
      title: "Uscire dall'app",
      intro: "Apri il tuo **Profilo**, tocca **Esci** in fondo alla pagina e conferma. Per rientrare ti serve un nuovo link o codice.",
      link: { href: "/profilo", label: "Apri Profilo" },
      keywords: ["logout", "disconnettere", "esci"],
    },
  ],
  synonyms: [
    ["ricarica", "ricaricare", "bonifico", "versamento", "versare"],
    ["saldo", "credito", "conto", "soldi", "borsellino"],
    ["carta", "bancomat", "pagamento online", "pagare"],
    ["ordine", "spesa", "carrello", "ordinare", "comprare"],
    ["cancellare", "annullare", "eliminare", "togliere"],
    ["modificare", "cambiare", "correggere"],
    ["famiglia", "familiare", "marito", "moglie", "partner", "coinquilino"],
    ["notifica", "notifiche", "avviso", "avvisi", "campanella"],
    ["accesso", "entrare", "accedere", "login", "password", "codice"],
    ["installare", "telefono", "cellulare", "iphone", "android", "schermata home"],
    ["rimborso", "rimborsi", "restituzione", "restituire"],
    ["ritiro", "ritirare", "consegna"],
    ["peso", "pesata", "quantita", "grammi"],
    ["uscire", "esci", "logout", "disconnettere"],
  ],
  stopwords: [
    "come", "cosa", "cos", "il", "lo", "la", "i", "gli", "le", "un", "una", "uno", "di", "del", "della",
    "dei", "delle", "da", "dal", "in", "nel", "nella", "con", "su", "per", "tra", "fra", "e", "o", "a",
    "al", "alla", "che", "chi", "non", "mi", "ti", "si", "ci", "posso", "faccio", "devo", "dove",
    "perche", "mio", "mia", "miei", "mie", "sono", "ho", "ha", "voglio", "vorrei", "si", "puo",
  ],
};
