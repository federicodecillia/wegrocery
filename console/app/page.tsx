import Link from "next/link";
import { refreshAllAction } from "@/app/actions/instances";
import { ActionButton } from "@/components/action-button";
import { FleetRollout } from "@/components/fleet-rollout";
import { FleetTable } from "@/components/fleet-table";
import { Shell } from "@/components/shell";
import { Card, Notice, PageTitle, buttonClass } from "@/components/ui";
import { requireOperator } from "@/lib/auth/session";
import { listInstancesWithLatest } from "@/lib/db/queries";
import { latestRelease } from "@/lib/fleet/refresh";
import { fleetNewest, fleetRows, fleetTotals, type FleetRow } from "@/lib/fleet/table";
import { reportError } from "@/lib/report-error";
import { formatNumber } from "@/lib/utils";

export default async function InstancesPage() {
  await requireOperator();
  let rows: FleetRow[] = [];
  let newest: string | null = null;
  let release: string | null = null;
  let loadError = false;
  try {
    const sources = await listInstancesWithLatest(false);
    release = await latestRelease();
    newest = fleetNewest(sources, release);
    rows = fleetRows(sources, newest);
  } catch (e) {
    reportError("instances_page", e);
    loadError = true;
  }
  const totals = fleetTotals(rows);

  return (
    <Shell current="/">
      <PageTitle
        title="Istanze"
        subtitle={newest ? `Ultima versione: ${newest}${release ? ` (release GitHub ${release})` : ""}` : undefined}
        actions={
          <>
            <ActionButton action={refreshAllAction} label="Aggiorna tutto" pendingLabel="Aggiornamento…" variant="primary" />
            <a href="/api/export" className={buttonClass("secondary")}>
              Esporta CSV
            </a>
            <Link href="/nuovo" className={buttonClass("secondary")}>
              Nuovo gruppo
            </Link>
            <Link href="/istanze/aggiungi" className={buttonClass("secondary")}>
              Aggiungi istanza esistente
            </Link>
          </>
        }
      />
      {loadError && <Notice tone="danger" className="mb-4">Database della console non raggiungibile: controlla DATABASE_URL e le migrazioni.</Notice>}
      <div className="mb-5 grid grid-cols-3 gap-3">
        {[
          ["Istanze", totals.instances],
          ["Soci attivi", totals.activeMembers],
          ["Ordini 30 gg", totals.orders30],
        ].map(([label, value]) => (
          <Card key={label} className="p-3 sm:p-4">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-xl font-semibold tabular-nums sm:text-2xl">{formatNumber(value as number)}</p>
          </Card>
        ))}
      </div>
      <FleetTable rows={rows} newest={newest} />
      <FleetRollout />
    </Shell>
  );
}
