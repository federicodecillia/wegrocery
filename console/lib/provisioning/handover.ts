// The message for the group's first admin at the end of the wizard
// (Italian: Federico's groups are Italian-speaking; an English group gets
// the same text to translate by hand).

export interface HandoverInput {
  groupName: string;
  appUrl: string;
  adminEmail: string;
  emailOnSharedDomain: boolean;
  paymentsConfigured: boolean;
}

export function handoverSubject(groupName: string): string {
  return `${groupName}: la vostra app WeGrocery è pronta`;
}

export function handoverText(i: HandoverInput): string {
  const lines = [
    "Ciao,",
    "",
    `l'app di ${i.groupName} è online: ${i.appUrl}`,
    "",
    "Per entrare:",
    `1. Apri ${i.appUrl} e accedi con ${i.adminEmail}: ricevi un'email con un link e un codice.`,
    "2. Al primo accesso sei l'amministratore del gruppo e l'app ti guida nella configurazione iniziale: nome, logo e colori, modalità di pagamento, testo \"Il nostro gruppo\".",
    "3. Poi, da Admin → Soci, aggiungi i soci e mandagli l'invito; da Admin → Catalogo i fornitori e i prodotti; infine apri il primo ciclo d'ordine.",
    "",
    "Da controllare in Admin → Impostazioni → Stato della configurazione: nessuna voce deve risultare \"Mancante\".",
  ];
  if (i.emailOnSharedDomain) {
    lines.push("", "Le email partono per ora da un dominio condiviso: quando volete usare il vostro, scrivetemi e lo spostiamo.");
  }
  if (!i.paymentsConfigured) {
    lines.push("", "I pagamenti online non sono attivi: se vi servono, preparate un account Stripe intestato al gruppo e lo colleghiamo.");
  }
  lines.push("", "Per qualsiasi dubbio rispondi a questa email.", "", "Federico");
  return lines.join("\n");
}
