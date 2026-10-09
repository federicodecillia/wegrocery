import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { refreshOneAction, setArchived } from "@/app/actions/instances";
import { ActionButton } from "@/components/action-button";
import { RedeployButton } from "@/components/redeploy-button";
import { Shell } from "@/components/shell";
import { Sparkline } from "@/components/sparkline";
import { StepChecklist } from "@/components/step-checklist";
import { Badge, Card, Notice, PageTitle, SectionTitle, buttonClass, type Tone } from "@/components/ui";
import { requireOperator } from "@/lib/auth/session";
import { getInstance, listAudit, listSnapshots, listSteps } from "@/lib/db/queries";
import { MODEL_LABEL } from "@/lib/fleet/table";
import { neonDashboardUrl } from "@/lib/providers/neon";
import { vercelDashboardUrl } from "@/lib/providers/vercel";
import { stepStates, type StepId } from "@/lib/provisioning/steps";
import { vercelProjectName } from "@/lib/slug";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { MetaForm } from "./meta-form";

export const metadata: Metadata = { title: "Istanza" };

const CONFIG_TONE: Record<string, Tone> = { ok: "ok", missing: "danger", warning: "warn", off: "neutral" };
const CONFIG_LABEL: Record<string, string> = { ok: "ok", missing: "mancante", warning: "avviso", off: "spento" };

export default async function InstancePage(props: { params: Promise<{ id: string }> }) {
  await requireOperator();
  const { id } = await props.params;
  const instance = await getInstance(id);
  if (!instance) notFound();
  const [snapshots, stepRows, auditRows] = await Promise.all([listSnapshots(id, 60), listSteps(id), listAudit(id, 20)]);
  const latest = snapshots[0] ?? null;
  const stats = latest?.stats ?? null;
  const withStats = snapshots.filter((s) => s.stats).reverse();
  const states = stepStates(stepRows);
  const details = Object.fromEntries(stepRows.map((r) => [r.step, r.detail])) as Partial<Record<StepId, string | null>>;
  const archived = instance.status === "archived";

  const facts: [string, string][] = stats
    ? [
        ["Versione", stats.version],
        ["Soci attivi", formatNumber(stats.members.active)],
        ["Admin", formatNumber(stats.members.admins)],
        ["Soci totali", formatNumber(stats.members.total)],
        ["Cicli (aperti)", `${formatNumber(stats.cycles.total)} (${stats.cycles.open})`],
        ["Ultima chiusura", formatDateTime(stats.cycles.lastClosedAt)],
        ["Ordini 30 gg", formatNumber(stats.ordersLast30Days)],
        ["Spazio DB", formatBytes(stats.databaseBytes)],
        ["Modalità di pagamento", stats.paymentMode === "per_order" ? "per ordine" : stats.paymentMode === "wallet" ? "borsellino" : stats.paymentMode],
        ["Configurazione iniziale", stats.setupCompleted ? "completata" : "da completare"],
        ["Installata il", formatDate(stats.installedAt)],
        ["Migrazioni in sospeso", stats.pendingMigrations.length ? stats.pendingMigrations.join(", ") : "nessuna"],
      ]
    : [];

  return (
    <Shell>
      <PageTitle
        title={instance.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <a href={instance.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">
              {instance.url}
            </a>
            <Badge>{MODEL_LABEL[instance.hostingModel]}</Badge>
            {instance.status === "provisioning" && <Badge tone="warn">in creazione</Badge>}
            {archived && <Badge>archiviata</Badge>}
          </span>
        }
        actions={
          <>
            <ActionButton action={refreshOneAction.bind(null, id)} label="Aggiorna" pendingLabel="Aggiornamento…" variant="primary" />
            {instance.vercelProjectId && !archived && <RedeployButton instanceId={id} name={instance.name} />}
            {instance.status === "provisioning" && (
              <Link href={`/nuovo?istanza=${id}`} className={buttonClass("secondary")}>
                Continua la creazione
              </Link>
            )}
            <ActionButton
              action={setArchived.bind(null, id, !archived)}
              label={archived ? "Ripristina" : "Archivia"}
              variant={archived ? "secondary" : "danger"}
              confirm={archived ? undefined : `Archiviare ${instance.name}? Esce dalla tabella e dagli aggiornamenti; l'app non viene toccata.`}
            />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <SectionTitle>Ultime statistiche</SectionTitle>
            {!latest && <p className="text-sm text-muted">Nessuna rilevazione: premi Aggiorna.</p>}
            {latest && (
              <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
                <Badge tone={latest.healthOk ? "ok" : "danger"}>{latest.healthOk ? "In salute" : "Non in salute"}</Badge>
                <span className="text-muted">rilevate il {formatDateTime(latest.takenAt)}</span>
              </p>
            )}
            {latest?.error && <Notice tone="warn" className="mb-3">{latest.error}</Notice>}
            {facts.length > 0 && (
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                {facts.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3 border-b border-line py-1">
                    <dt className="text-muted">{k}</dt>
                    <dd className="text-right break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Card>

          {stats && (
            <Card>
              <SectionTitle>Stato della configurazione</SectionTitle>
              <ul className="flex flex-wrap gap-2">
                {stats.config.map((c) => (
                  <li key={c.id}>
                    <Badge tone={CONFIG_TONE[c.status]}>
                      {c.id}: {CONFIG_LABEL[c.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <SectionTitle>Storico</SectionTitle>
            <Sparkline values={withStats.map((s) => s.stats!.members.active)} label="Soci attivi" />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs text-muted">
                  <tr>
                    <th scope="col" className="py-1 pr-3 font-medium">Quando</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Salute</th>
                    <th scope="col" className="py-1 pr-3 font-medium">Versione</th>
                    <th scope="col" className="py-1 pr-3 text-right font-medium">Soci attivi</th>
                    <th scope="col" className="py-1 font-medium">Errore</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {snapshots.slice(0, 15).map((s) => (
                    <tr key={s.id}>
                      <td className="py-1 pr-3 whitespace-nowrap">{formatDateTime(s.takenAt)}</td>
                      <td className="py-1 pr-3">{s.healthOk ? "ok" : "no"}</td>
                      <td className="py-1 pr-3 font-mono text-xs">{s.healthVersion ?? "—"}</td>
                      <td className="py-1 pr-3 text-right tabular-nums">{formatNumber(s.stats?.members.active)}</td>
                      <td className="py-1 text-xs text-muted">{s.error ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <SectionTitle>Note e impostazioni</SectionTitle>
            <MetaForm
              instanceId={id}
              url={instance.url}
              notes={instance.notes}
              rolloutOrder={instance.rolloutOrder}
              vercelTeamSlug={instance.vercelTeamSlug}
            />
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <SectionTitle>Collegamenti</SectionTitle>
            <ul className="flex flex-col gap-1.5 text-sm">
              {instance.vercelProjectId && (
                <li>
                  <a
                    className="underline-offset-2 hover:underline"
                    target="_blank"
                    rel="noreferrer"
                    href={vercelDashboardUrl(instance.vercelTeamSlug, vercelProjectName(instance.slug))}
                  >
                    Progetto su Vercel
                  </a>
                  {!instance.vercelTeamSlug && <span className="text-xs text-muted"> (imposta lo slug del team per il link diretto)</span>}
                </li>
              )}
              {instance.neonProjectId && (
                <li>
                  <a className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer" href={neonDashboardUrl(instance.neonProjectId)}>
                    Database su Neon
                  </a>
                </li>
              )}
              <li>
                <a className="underline-offset-2 hover:underline" target="_blank" rel="noreferrer" href={`${instance.url}/api/health`}>
                  /api/health
                </a>
              </li>
            </ul>
            <dl className="mt-3 grid gap-1 text-xs text-muted">
              <div>Slug: <span className="font-mono">{instance.slug}</span></div>
              {instance.vercelTeamId && <div>Team Vercel: <span className="font-mono">{instance.vercelTeamId}</span></div>}
              {instance.vercelProjectId && <div>Progetto Vercel: <span className="font-mono">{instance.vercelProjectId}</span></div>}
              {instance.neonOrgId && <div>Org Neon: <span className="font-mono">{instance.neonOrgId}</span></div>}
              {instance.neonProjectId && <div>Progetto Neon: <span className="font-mono">{instance.neonProjectId}</span></div>}
              <div>Segreto statistiche: {instance.statsSecretEnc ? "salvato (cifrato)" : "assente"}</div>
              <div>Creata il {formatDate(instance.createdAt)}</div>
            </dl>
          </Card>

          {stepRows.length > 0 && (
            <Card>
              <SectionTitle>Creazione</SectionTitle>
              <StepChecklist states={states} details={details} instanceId={id} />
            </Card>
          )}

          <Card>
            <SectionTitle>Registro</SectionTitle>
            {auditRows.length === 0 && <p className="text-sm text-muted">Nessuna operazione.</p>}
            <ul className="flex flex-col gap-1.5 text-xs">
              {auditRows.map((a) => (
                <li key={a.id}>
                  <span className="text-muted">{formatDateTime(a.at)}</span> <span className="font-mono">{a.action}</span>
                  {a.detail && <span className="block break-words text-muted">{a.detail}</span>}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
