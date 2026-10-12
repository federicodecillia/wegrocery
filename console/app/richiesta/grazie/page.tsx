import type { Metadata } from "next";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Richiesta inviata" };

export default function ThanksPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-4">
      <Card className="w-full">
        <h1 className="text-xl font-semibold">Grazie!</h1>
        <p className="mt-2 text-sm text-muted">
          Abbiamo ricevuto la richiesta. Ti scriviamo all&apos;indirizzo che hai indicato per i prossimi passi: di solito entro
          pochi giorni.
        </p>
      </Card>
    </main>
  );
}
