"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Input } from "@/components/ui";
import { HEALTH_LABEL, matchesSearch, type FleetRow } from "@/lib/fleet/table";
import { formatBytes, formatDate, formatDateTime, formatNumber } from "@/lib/utils";
import { RedeployButton } from "./redeploy-button";

function HealthBadge({ row }: { row: FleetRow }) {
  const tone = row.health === "ok" ? "ok" : row.health === "down" ? "danger" : "neutral";
  return (
    <Badge tone={tone} title={row.error ?? undefined}>
      {HEALTH_LABEL[row.health]}
    </Badge>
  );
}

function VersionCell({ row, newest }: { row: FleetRow; newest: string | null }) {
  if (!row.version) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="font-mono text-xs">{row.version}</span>
      {row.behind && (
        <Badge tone="warn" title={`Ultima versione: ${newest}`}>
          indietro
        </Badge>
      )}
    </span>
  );
}

function ConfigCell({ row }: { row: FleetRow }) {
  if (row.health === "unknown" && row.activeMembers === null) return <span className="text-muted">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {row.configMissing > 0 && <Badge tone="danger">{row.configMissing} mancanti</Badge>}
      {row.configWarning > 0 && <Badge tone="warn">{row.configWarning} avvisi</Badge>}
      {row.pendingMigrations > 0 && <Badge tone="danger">{row.pendingMigrations} migrazioni</Badge>}
      {row.configMissing + row.configWarning + row.pendingMigrations === 0 && <Badge tone="ok">ok</Badge>}
    </span>
  );
}

export function FleetTable({ rows, newest }: { rows: FleetRow[]; newest: string | null }) {
  const [q, setQ] = useState("");
  const visible = rows.filter((r) => matchesSearch(r, q));

  return (
    <div>
      <div className="mb-3 max-w-sm">
        <label htmlFor="fleet-search" className="sr-only">
          Cerca
        </label>
        <Input id="fleet-search" type="search" placeholder="Cerca per nome, slug o URL" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {visible.length === 0 && <p className="text-sm text-muted">Nessuna istanza.</p>}

      {/* Phones: one card per instance. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {visible.map((r) => (
          <li key={r.id} className="rounded-xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/istanze/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                  {r.name}
                </Link>
                <p className="truncate text-xs text-muted">{r.url}</p>
              </div>
              <HealthBadge row={r} />
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Versione</dt>
              <dd><VersionCell row={r} newest={newest} /></dd>
              <dt className="text-muted">Soci attivi</dt>
              <dd>{formatNumber(r.activeMembers)}</dd>
              <dt className="text-muted">Ordini 30 gg</dt>
              <dd>{formatNumber(r.orders30)}</dd>
              <dt className="text-muted">Modello</dt>
              <dd>{r.model}</dd>
              <dt className="text-muted">Configurazione</dt>
              <dd><ConfigCell row={r} /></dd>
              <dt className="text-muted">Aggiornata</dt>
              <dd>{formatDateTime(r.refreshedAt)}</dd>
            </dl>
          </li>
        ))}
      </ul>

      {/* From md: the table. */}
      <div className="hidden overflow-x-auto rounded-xl border border-line bg-surface md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-bg text-xs text-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Nome</th>
              <th scope="col" className="px-3 py-2 font-medium">Modello</th>
              <th scope="col" className="px-3 py-2 font-medium">Creata il</th>
              <th scope="col" className="px-3 py-2 font-medium">Versione</th>
              <th scope="col" className="px-3 py-2 font-medium">Salute</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Soci attivi</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Admin</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Cicli</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Ordini 30 gg</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Spazio DB</th>
              <th scope="col" className="px-3 py-2 font-medium">Configurazione</th>
              <th scope="col" className="px-3 py-2 font-medium">Aggiornata</th>
              <th scope="col" className="px-3 py-2 font-medium"><span className="sr-only">Azioni</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {visible.map((r) => (
              <tr key={r.id} className="align-top hover:bg-bg/60">
                <td className="px-3 py-2">
                  <Link href={`/istanze/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                    {r.name}
                  </Link>
                  <a href={r.url} target="_blank" rel="noreferrer" className="block max-w-56 truncate text-xs text-muted hover:underline">
                    {r.url.replace(/^https:\/\//, "")}
                  </a>
                  {r.status === "provisioning" && <Badge tone="warn">in creazione</Badge>}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">{r.model}</td>
                <td className="px-3 py-2 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                <td className="px-3 py-2"><VersionCell row={r} newest={newest} /></td>
                <td className="px-3 py-2"><HealthBadge row={r} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.activeMembers)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.admins)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.cycles)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatNumber(r.orders30)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">{formatBytes(r.databaseBytes)}</td>
                <td className="px-3 py-2"><ConfigCell row={r} /></td>
                <td className="px-3 py-2 text-xs whitespace-nowrap text-muted">{formatDateTime(r.refreshedAt)}</td>
                <td className="px-3 py-2">
                  {r.status === "live" && <RedeployButton instanceId={r.id} name={r.name} label="Ridistribuisci versione" compact />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
