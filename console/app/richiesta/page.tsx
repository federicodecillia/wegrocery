import type { Metadata } from "next";
import { Card } from "@/components/ui";
import { IntakeForm } from "./intake-form";

export const metadata: Metadata = {
  title: "Richiedi WeGrocery per il tuo gruppo",
  description: "Modulo di richiesta per attivare WeGrocery per un gruppo d'acquisto.",
};

export default function IntakePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">WeGrocery per il tuo gruppo</h1>
      <p className="mt-2 text-sm text-muted">
        WeGrocery è l&apos;app open source per i gruppi d&apos;acquisto: ordini settimanali, saldo dei soci, fornitori. Raccontaci il
        vostro gruppo e ti ricontattiamo per attivarla, gestita da noi oppure sugli account del gruppo.
      </p>
      <Card className="mt-6">
        <IntakeForm />
      </Card>
    </main>
  );
}
