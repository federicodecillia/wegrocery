import type { Metadata } from "next";
import Link from "next/link";
import { setRequestStatus } from "@/app/actions/requests";
import { ActionButton } from "@/components/action-button";
import { Shell } from "@/components/shell";
import { Badge, Card, Notice, PageTitle, buttonClass, type Tone } from "@/components/ui";
import { requireOperator } from "@/lib/auth/session";
import { listRequests } from "@/lib/db/queries";
import type { IntakeRequest, RequestStatus } from "@/lib/db/schema";
import { reportError } from "@/lib/report-error";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = { title: "Richieste" };

const STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  new: { label: "Nuova", tone: "warn" },
  in_progress: { label: "In lavorazione", tone: "neutral" },
  created: { label: "Creata", tone: "ok" },
  discarded: { label: "Scartata", tone: "neutral" },
};

const yes = (b: boolean) => (b ? "sì" : "no");

export default async function RequestsPage() {
  await requireOperator();
  let rows: IntakeRequest[] = [];
  let loadError = false;
  try {
    rows = await listRequests();
  } catch (e) {
    reportError("requests_page", e);
    loadError = true;
  }

  return (
    <Shell current="/richieste">
      <PageTitle
        title="Richieste"
        subtitle={
          <>
            Dal modulo pubblico{" "}
            <Link href="/richiesta" className="underline underline-offset-2">
              /richiesta
            </Link>
            .
          </>
        }
      />
      {loadError && <Notice tone="danger" className="mb-4">Database della console non raggiungibile.</Notice>}
      {!loadError && rows.length === 0 && <p className="text-sm text-muted">Nessuna richiesta.</p>}
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <Card key={r.id}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="font-semibold">
                  {r.groupName}
                  {r.city && <span className="font-normal text-muted"> · {r.city}</span>}
                </h2>
                <p className="text-sm">
                  {r.contactName} · <a href={`mailto:${r.contactEmail}`} className="underline underline-offset-2">{r.contactEmail}</a>
                </p>
                <p className="text-xs text-muted">Ricevuta il {formatDateTime(r.createdAt)}</p>
              </div>
              <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              {[
                ["Soci indicativi", r.membersEstimate ?? "—"],
                ["Lingua / valuta / fuso", `${r.locale} · ${r.currency} · ${r.timeZone}`],
                ["Modello preferito", r.hostingPreference === "managed" ? "Gestito" : "Del gruppo"],
                ["Dominio email", r.emailDomain ?? "—"],
                ["DNS gestiti da", r.dnsManager ?? "—"],
                ["Pagamento", r.paymentMode === "per_order" ? "per ordine" : "borsellino"],
                ["Pagamenti online", yes(r.onlinePayments)],
                ["Accesso Google", yes(r.googleLogin)],
                ["Controllo tessera", yes(r.cardCheck)],
                ["Logo", r.logoUrl ?? "—"],
                ["Colori", r.colors ?? "—"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-2 border-b border-line py-1 sm:block">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="break-all">{v}</dd>
                </div>
              ))}
            </dl>
            {r.notes && <p className="mt-3 rounded-lg bg-bg p-3 text-sm whitespace-pre-wrap">{r.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {r.status !== "created" && (
                <Link href={`/nuovo?richiesta=${r.id}`} className={buttonClass("primary")}>
                  Crea gruppo da questa richiesta
                </Link>
              )}
              {r.status !== "in_progress" && r.status !== "created" && (
                <ActionButton action={setRequestStatus.bind(null, r.id, "in_progress")} label="In lavorazione" />
              )}
              {r.status !== "discarded" && r.status !== "created" && (
                <ActionButton action={setRequestStatus.bind(null, r.id, "discarded")} label="Scarta" confirm="Scartare questa richiesta?" />
              )}
              {r.status === "discarded" && <ActionButton action={setRequestStatus.bind(null, r.id, "new")} label="Riapri" />}
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
