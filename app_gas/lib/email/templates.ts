type SupplierEmailInput = {
  cycleTitle: string;
  pickupDate: Date | null;
  grandTotal: number;
  productCount: number;
  memberCount: number;
};

const formatPickup = (d: Date): string =>
  d.toLocaleString("it-IT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });

const formatEur = (n: number): string => n.toFixed(2).replace(".", ",");

export function supplierOrderEmail(input: SupplierEmailInput): {
  subject: string;
  text: string;
} {
  const { cycleTitle, pickupDate, grandTotal, productCount, memberCount } = input;
  const subject = `Ordine GAS Porta Moneta — ${cycleTitle}`;
  const pickupLine = pickupDate
    ? `Data ritiro prevista: ${formatPickup(pickupDate)}.`
    : "Data ritiro: da concordare.";
  const text = `Buongiorno,

in allegato la distinta dell'ordine del GAS Porta Moneta per il ciclo "${cycleTitle}".

Il file Excel ha una riga per ogni prodotto e una colonna per ogni socio. Le celle gialle sono già pre-compilate con il preventivo: dopo la pesata, modifichi solo le celle dove il costo effettivo è diverso (lasciando le altre invariate). La riga "Spedizione" indica la quota per socio (anche questa modificabile se varia). I totali per socio e per prodotto si ricalcolano da soli.

Quando ha finito, ci rimandi il file in risposta a questa email — lo carichiamo nell'app con un click e i saldi dei soci vengono aggiornati automaticamente.

Riepilogo del preventivo: ${formatEur(grandTotal)} euro su ${productCount} ${productCount === 1 ? "prodotto" : "prodotti"} per ${memberCount} ${memberCount === 1 ? "socio" : "soci"}.
${pickupLine}

Il file è in formato .xlsx, si apre con Excel, LibreOffice e Google Sheets senza problemi.

Grazie,
APS Porta Moneta — GAS frutta e verdura
`;
  return { subject, text };
}
