import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { Card, PageTitle } from "@/components/ui";
import { requireOperator } from "@/lib/auth/session";
import { AddInstanceForm } from "./add-instance-form";

export const metadata: Metadata = { title: "Aggiungi istanza" };

export default async function AddInstancePage() {
  await requireOperator();
  return (
    <Shell>
      <PageTitle
        title="Aggiungi istanza esistente"
        subtitle="Per un'installazione già online (es. Porta Moneta, la demo): la console ne legge salute e statistiche."
      />
      <Card className="max-w-2xl">
        <AddInstanceForm />
      </Card>
    </Shell>
  );
}
